import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  TaskAssigneeType,
} from '../types/task.js';
import type { AgentId } from '../types/agent.js';
import { writeJSON, readJSON, listJSONFiles } from '../utils/json-persist.js';
import { withLock } from '../utils/file-lock.js';
import { generateId } from '../utils/id-generator.js';
import { createLogger } from '../utils/logger.js';
import { validateTransition } from './state-machine.js';
import { TaskWatcher } from './task-watcher.js';

const logger = createLogger('task-store');

export class TaskStore {
  private dataDir: string;
  private watcher: TaskWatcher;

  constructor(dataDir: string) {
    this.dataDir = path.join(dataDir, 'tasks');
    this.watcher = new TaskWatcher();
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    // Create a lockfile marker for proper-lockfile to work
    const markerPath = path.join(this.dataDir, '.lock-marker');
    try {
      await fs.access(markerPath);
    } catch {
      await fs.writeFile(markerPath, '');
    }
  }

  getWatcher(): TaskWatcher {
    return this.watcher;
  }

  /**
   * Create a new task.
   */
  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: generateId('task'),
      title: input.title,
      description: input.description,
      assignee: input.assignee ?? null,
      status: 'pending',
      priority: input.priority ?? 'medium',
      dependencies: input.dependencies ?? [],
      requirement_id: input.requirement_id,
      artifacts: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status_history: [],
    };

    const filePath = this.getFilePath(task.id);
    await withLock(this.dataDir, async () => {
      await writeJSON(filePath, task);
    });

    logger.info({ taskId: task.id, title: task.title }, 'Task created');
    this.watcher.emitTaskCreated(task);
    return task;
  }

  /**
   * Update task fields (non-status changes).
   */
  async update(id: string, changes: Partial<Omit<Task, 'id' | 'status' | 'status_history'>>): Promise<Task> {
    const filePath = this.getFilePath(id);

    return withLock(this.dataDir, async () => {
      const task = await readJSON<Task>(filePath);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const updated: Task = {
        ...task,
        ...changes,
        id: task.id,
        status: task.status,
        status_history: task.status_history,
        updated_at: new Date().toISOString(),
      };

      await writeJSON(filePath, updated);
      logger.info({ taskId: id, changes: Object.keys(changes) }, 'Task updated');
      this.watcher.emitTaskUpdated(updated);
      return updated;
    });
  }

  /**
   * Transition task status with validation.
   */
  async transitionStatus(
    id: string,
    to: TaskStatus,
    reason: string,
    actor: AgentId | 'system' | 'user' = 'system'
  ): Promise<Task> {
    const filePath = this.getFilePath(id);

    return withLock(this.dataDir, async () => {
      const task = await readJSON<Task>(filePath);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      validateTransition(task.status, to);

      const updated: Task = {
        ...task,
        status: to,
        updated_at: new Date().toISOString(),
        status_history: [
          ...task.status_history,
          {
            from: task.status,
            to,
            changed_by: actor,
            reason,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await writeJSON(filePath, updated);
      logger.info(
        { taskId: id, from: task.status, to, actor },
        'Task status changed'
      );
      this.watcher.emitTaskStatusChanged(updated, task.status, to);
      return updated;
    });
  }

  /**
   * Get a single task by ID.
   */
  async get(id: string): Promise<Task | null> {
    const filePath = this.getFilePath(id);
    return readJSON<Task>(filePath);
  }

  /**
   * List tasks with optional filters.
   */
  async list(filter?: {
    status?: TaskStatus;
    assignee?: TaskAssigneeType;
    requirement_id?: string;
    priority?: TaskPriority;
  }): Promise<Task[]> {
    const files = await listJSONFiles(this.dataDir);
    const tasks: Task[] = [];

    for (const file of files) {
      const task = await readJSON<Task>(file);
      if (task) {
        tasks.push(task);
      }
    }

    if (!filter) return tasks;

    return tasks.filter((task) => {
      if (filter.status && task.status !== filter.status) return false;
      if (filter.assignee && task.assignee !== filter.assignee) return false;
      if (filter.requirement_id && task.requirement_id !== filter.requirement_id) return false;
      if (filter.priority && task.priority !== filter.priority) return false;
      return true;
    });
  }

  /**
   * Add an artifact path to a task.
   */
  async addArtifact(id: string, artifactPath: string): Promise<Task> {
    const filePath = this.getFilePath(id);

    return withLock(this.dataDir, async () => {
      const task = await readJSON<Task>(filePath);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const updated: Task = {
        ...task,
        artifacts: [...task.artifacts, artifactPath],
        updated_at: new Date().toISOString(),
      };

      await writeJSON(filePath, updated);
      return updated;
    });
  }

  /**
   * Delete a task.
   */
  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);

    await withLock(this.dataDir, async () => {
      try {
        await fs.unlink(filePath);
        logger.info({ taskId: id }, 'Task deleted');
        this.watcher.emitTaskDeleted(id);
      } catch {
        // File may not exist, that's okay
      }
    });
  }

  private getFilePath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }
}
