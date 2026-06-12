import type { Task, TaskStatus } from '../types/task.js';

/**
 * Perform a topological sort on tasks based on their dependencies.
 * Returns tasks in dependency order (dependencies first).
 * Throws if a circular dependency is detected.
 */
export function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection
  const result: Task[] = [];

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;

    if (visiting.has(taskId)) {
      throw new Error(`Circular dependency detected involving task: ${taskId}`);
    }

    const task = taskMap.get(taskId);
    if (!task) return; // Dependency on non-existent task (ignore)

    visiting.add(taskId);

    for (const depId of task.dependencies) {
      visit(depId);
    }

    visiting.delete(taskId);
    visited.add(taskId);
    result.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}

/**
 * Check if adding a dependency would create a circular dependency.
 */
export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  newDependencyId: string
): boolean {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Check if newDependencyId (or any of its transitive deps) depends on taskId
  const visited = new Set<string>();

  function hasPath(currentId: string, targetId: string): boolean {
    if (currentId === targetId) return true;
    if (visited.has(currentId)) return false;

    visited.add(currentId);
    const task = taskMap.get(currentId);
    if (!task) return false;

    for (const depId of task.dependencies) {
      if (hasPath(depId, targetId)) return true;
    }

    return false;
  }

  // Would creating dependency: taskId -> newDependencyId create a cycle?
  // A cycle exists if newDependencyId transitively depends on taskId
  return hasPath(newDependencyId, taskId);
}

/**
 * Get tasks that are ready to be worked on:
 * - Status is "pending"
 * - All dependencies are "completed"
 */
export function getReadyTasks(tasks: Task[]): Task[] {
  const completedIds = new Set(
    tasks.filter((t) => t.status === 'completed').map((t) => t.id)
  );

  return tasks.filter((task) => {
    if (task.status !== 'pending') return false;
    if (task.dependencies.length === 0) return true;

    // All dependencies must be completed
    return task.dependencies.every((depId) => completedIds.has(depId));
  });
}

/**
 * Get tasks that are blocked (have unmet dependencies).
 */
export function getBlockedTasks(tasks: Task[]): Task[] {
  const completedIds = new Set(
    tasks.filter((t) => t.status === 'completed').map((t) => t.id)
  );

  return tasks.filter((task) => {
    if (task.status !== 'pending' && task.status !== 'blocked') return false;
    if (task.dependencies.length === 0) return false;

    // Has at least one uncompleted dependency
    return task.dependencies.some((depId) => !completedIds.has(depId));
  });
}
