import type { Tool } from '../types/tool.js';
import type { AgentId } from '../types/agent.js';
import { getAllowedTools } from './permissions.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tool-registry');

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool.
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    logger.info({ toolName: tool.name }, 'Tool registered');
  }

  /**
   * Get a tool by name.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools available for a specific agent (filtered by permissions).
   */
  getForAgent(agentId: AgentId): Tool[] {
    const allowed = getAllowedTools(agentId);
    return allowed
      .map((name) => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined);
  }

  /**
   * List all registered tool names.
   */
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all registered tools.
   */
  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }
}
