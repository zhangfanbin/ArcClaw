/**
 * Agent role configuration schema.
 *
 * - For **built-in customizable** agents (pd, frontend, backend, qa):
 *   all fields except `id` are optional overrides. Unspecified fields use
 *   the built-in defaults defined in code.
 *
 * - For **user-defined custom** agents:
 *   all fields should be provided. Behavior is driven entirely by config.
 */
export interface AgentRoleConfig {
  /** Unique agent role identifier (required). */
  id: string;

  /** Override display name shown in UI and logs. */
  displayName?: string;

  /** Short description of this role's responsibilities. */
  description?: string;

  /** Override model tier: 'powerful' uses config.llm.model, 'fast' uses config.llm.modelFast. */
  modelTier?: 'powerful' | 'fast';

  /** Override tool permission list for this agent. */
  allowedTools?: string[];

  /**
   * System prompt source file name (relative to `.arcclaw/agents/{role}/`).
   * E.g. 'system-prompt.md'. When specified, the file content is loaded as
   * the agent's system prompt, overriding the built-in default.
   */
  systemPromptSource?: string;

  /** Whether this agent role is enabled. Defaults to `true`. */
  enabled?: boolean;
}
