import type { AgentId } from '../types/agent.js';

/**
 * Tool permission matrix defining which tools each agent can use.
 */
export const TOOL_PERMISSIONS: Record<AgentId, string[]> = {
  team_leader: [], // No tools - coordination only
  pd: ['file_writer', 'file_reader', 'code_search'],
  frontend: ['bash_executor', 'file_writer', 'file_editor', 'file_reader', 'code_search'],
  backend: ['bash_executor', 'file_writer', 'file_editor', 'file_reader', 'code_search'],
  qa: ['bash_executor', 'file_writer', 'file_reader', 'code_search'],
};

/**
 * Check if an agent has permission to use a specific tool.
 */
export function hasPermission(agentId: AgentId, toolName: string): boolean {
  const allowed = TOOL_PERMISSIONS[agentId];
  return allowed ? allowed.includes(toolName) : false;
}

/**
 * Get all tool names an agent is allowed to use.
 */
export function getAllowedTools(agentId: AgentId): string[] {
  return TOOL_PERMISSIONS[agentId] || [];
}
