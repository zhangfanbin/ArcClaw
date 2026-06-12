// Agent-related types

export type AgentId = 'team_leader' | 'pd' | 'frontend' | 'backend' | 'qa';

export type AgentState =
  | 'idle'
  | 'thinking'
  | 'executing_tool'
  | 'waiting'
  | 'error';

export interface AgentStatus {
  id: AgentId;
  state: AgentState;
  current_task_id: string | null;
  context_usage: number; // estimated tokens used
  last_activity: string; // ISO 8601
  error: string | null;
}

export interface AgentConfig {
  id: AgentId;
  maxSteps: number;
  contextTokenBudget: number;
  concurrentTasks: number;
}

export const ALL_AGENT_IDS: AgentId[] = [
  'team_leader',
  'pd',
  'frontend',
  'backend',
  'qa',
];

export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = {
  team_leader: 'Team Leader',
  pd: 'PD Agent (Product Manager)',
  frontend: 'Frontend Agent',
  backend: 'Backend Agent',
  qa: 'QA Agent (Test Engineer)',
};
