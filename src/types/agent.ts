// Agent-related types

/** Built-in fixed role (cannot be customized or disabled). */
export type BuiltinAgentId = 'team_leader';

/** Built-in customizable roles (can be overridden via config files). */
export type DefaultAgentId = 'pd' | 'frontend' | 'backend' | 'qa';

/**
 * AgentId = BuiltinAgentId | DefaultAgentId | (string & {})
 *
 * The `(string & {})` trick keeps IDE auto-complete for the known values
 * while accepting arbitrary strings at runtime for user-defined agents.
 */
export type AgentId = BuiltinAgentId | DefaultAgentId | (string & {});

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

// ---------------------------------------------------------------------------
// Static constants
// ---------------------------------------------------------------------------

export const BUILTIN_AGENT_IDS: BuiltinAgentId[] = ['team_leader'];
export const DEFAULT_AGENT_IDS: DefaultAgentId[] = ['pd', 'frontend', 'backend', 'qa'];

/** @deprecated Use getRegisteredAgentIds() for the runtime-maintained list. */
export const ALL_AGENT_IDS: AgentId[] = [
  'team_leader',
  'pd',
  'frontend',
  'backend',
  'qa',
];

// ---------------------------------------------------------------------------
// Runtime agent registry
// ---------------------------------------------------------------------------

/** Display names — mutable at runtime so custom agents can register their own. */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  team_leader: 'Team Leader',
  pd: 'PD Agent (Product Manager)',
  frontend: 'Frontend Agent',
  backend: 'Backend Agent',
  qa: 'QA Agent (Test Engineer)',
};

let registeredAgentIds: string[] = [
  ...BUILTIN_AGENT_IDS,
  ...DEFAULT_AGENT_IDS,
];

/** Return the current list of registered agent IDs. */
export function getRegisteredAgentIds(): string[] {
  return [...registeredAgentIds];
}

/** Register a new agent ID at runtime (called during bootstrap for custom agents). */
export function registerAgentId(id: string): void {
  if (!registeredAgentIds.includes(id)) {
    registeredAgentIds.push(id);
  }
}

/** Update or set the display name for an agent role. */
export function updateDisplayName(id: string, name: string): void {
  AGENT_DISPLAY_NAMES[id] = name;
}
