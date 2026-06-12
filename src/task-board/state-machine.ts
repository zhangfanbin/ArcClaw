import type { TaskStatus } from '../types/task.js';

/**
 * Valid state transitions for tasks.
 * Each status maps to the set of statuses it can transition to.
 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: [], // terminal state
  cancelled: [], // terminal state
};

/**
 * Check if a transition from one status to another is valid.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get all valid next states from a given status.
 */
export function getValidTransitions(from: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

/**
 * Validate a status transition and throw if invalid.
 */
export function validateTransition(
  from: TaskStatus,
  to: TaskStatus
): void {
  if (!canTransition(from, to)) {
    const allowed = getValidTransitions(from).join(', ') || 'none';
    throw new Error(
      `Invalid task status transition: "${from}" -> "${to}". Allowed transitions: ${allowed}`
    );
  }
}
