import { EventEmitter } from 'node:events';
import type { Task, TaskStatus } from '../types/task.js';

export interface TaskEvents {
  task_created: [task: Task];
  task_updated: [task: Task];
  task_status_changed: [
    task: Task,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
  ];
  task_deleted: [taskId: string];
}

/**
 * Typed event emitter for task board events.
 */
export class TaskWatcher extends EventEmitter {
  emitTaskCreated(task: Task): void {
    this.emit('task_created', task);
  }

  emitTaskUpdated(task: Task): void {
    this.emit('task_updated', task);
  }

  emitTaskStatusChanged(
    task: Task,
    oldStatus: TaskStatus,
    newStatus: TaskStatus
  ): void {
    this.emit('task_status_changed', task, oldStatus, newStatus);
  }

  emitTaskDeleted(taskId: string): void {
    this.emit('task_deleted', taskId);
  }

  onTaskCreated(handler: (task: Task) => void): this {
    return this.on('task_created', handler);
  }

  onTaskUpdated(handler: (task: Task) => void): this {
    return this.on('task_updated', handler);
  }

  onTaskStatusChanged(
    handler: (task: Task, oldStatus: TaskStatus, newStatus: TaskStatus) => void
  ): this {
    return this.on('task_status_changed', handler);
  }

  onTaskDeleted(handler: (taskId: string) => void): this {
    return this.on('task_deleted', handler);
  }
}
