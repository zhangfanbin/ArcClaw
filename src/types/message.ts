// Messaging types
import type { AgentId } from './agent.js';

export type MessageType =
  | 'task_assigned'
  | 'task_completed'
  | 'question'
  | 'answer'
  | 'review_request'
  | 'review_response'
  | 'progress_update'
  | 'broadcast';

export interface AgentMessage {
  id: string;
  from: AgentId;
  to: AgentId | 'all'; // 'all' = broadcast
  type: MessageType;
  subject: string;
  body: string;
  metadata: Record<string, unknown>; // task_id, requirement_id, etc.
  timestamp: string; // ISO 8601
  read: boolean;
}

export interface SendMessageInput {
  from: AgentId;
  to: AgentId | 'all';
  type: MessageType;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}
