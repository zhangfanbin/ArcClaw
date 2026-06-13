import type { AgentId } from '../types/agent.js';

/**
 * Built-in fixed permissions — cannot be overridden at runtime.
 */
const BUILTIN_PERMISSIONS: Record<string, string[]> = {
  team_leader: [], // No tools — coordination only
};

/**
 * Default permissions for built-in customizable agents.
 * These are loaded at startup and can be overridden via config files.
 */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  pd: ['file_writer', 'file_reader', 'code_search'],
  frontend: ['bash_executor', 'file_writer', 'file_editor', 'file_reader', 'code_search'],
  backend: ['bash_executor', 'file_writer', 'file_editor', 'file_reader', 'code_search'],
  qa: ['bash_executor', 'file_writer', 'file_reader', 'code_search'],
};

/**
 * Runtime permission map — mutable, populated during bootstrap.
 */
const runtimePermissions: Map<string, string[]> = new Map();

// Initialize with defaults
for (const [id, tools] of Object.entries(DEFAULT_PERMISSIONS)) {
  runtimePermissions.set(id, [...tools]);
}

/**
 * Register or override tool permissions for an agent role.
 * Called during bootstrap after reading agent config files.
 *
 * @throws If the agent is a built-in fixed role (team_leader).
 */
export function registerPermissions(agentId: string, tools: string[]): void {
  if (BUILTIN_PERMISSIONS[agentId] !== undefined) {
    throw new Error(`Cannot override permissions for built-in agent: ${agentId}`);
  }
  runtimePermissions.set(agentId, [...tools]);
}

/**
 * Check if an agent has permission to use a specific tool.
 */
export function hasPermission(agentId: AgentId, toolName: string): boolean {
  const builtin = BUILTIN_PERMISSIONS[agentId];
  if (builtin !== undefined) return builtin.includes(toolName);
  const runtime = runtimePermissions.get(agentId);
  return runtime ? runtime.includes(toolName) : false;
}

/**
 * Get all tool names an agent is allowed to use.
 */
export function getAllowedTools(agentId: AgentId): string[] {
  const builtin = BUILTIN_PERMISSIONS[agentId];
  if (builtin !== undefined) return [...builtin];
  return runtimePermissions.get(agentId) || [];
}

/**
 * Return a snapshot of the current full permission table.
 */
export function getToolPermissionsSnapshot(): Record<string, string[]> {
  const result: Record<string, string[]> = { ...BUILTIN_PERMISSIONS };
  for (const [id, tools] of runtimePermissions) {
    result[id] = [...tools];
  }
  return result;
}

/**
 * @deprecated Use getToolPermissionsSnapshot() or getAllowedTools() instead.
 * Proxy for backward compatibility with code that accesses TOOL_PERMISSIONS[id].
 */
export const TOOL_PERMISSIONS: Record<string, string[]> = new Proxy(
  {} as Record<string, string[]>,
  {
    get(_target, prop) {
      if (typeof prop === 'string') return getAllowedTools(prop);
      return undefined;
    },
    ownKeys() {
      return Object.keys(getToolPermissionsSnapshot());
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && (BUILTIN_PERMISSIONS[prop] || runtimePermissions.has(prop))) {
        return { enumerable: true, configurable: true, value: getAllowedTools(prop) };
      }
      return undefined;
    },
  },
);
