// Task board types
import type { AgentId } from './agent.js';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/** Reuse AgentId directly — includes built-in, default, and runtime-registered custom agents. */
export type TaskAssigneeType = AgentId;

export interface StatusChange {
  from: TaskStatus;
  to: TaskStatus;
  changed_by: AgentId | 'system' | 'user';
  reason: string;
  timestamp: string; // ISO 8601
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssigneeType | null;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[]; // task IDs this task depends on
  requirement_id: string; // parent requirement
  artifacts: string[]; // file paths produced
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  status_history: StatusChange[];
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assignee?: TaskAssigneeType | null;
  priority?: TaskPriority;
  dependencies?: string[];
  requirement_id: string;
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  task_ids: string[];
}
