import type { AgentId, AgentStatus } from '../types/agent.js';
import { ALL_AGENT_IDS } from '../types/agent.js';
import type { AppConfig } from '../config.js';
import { TaskStore } from '../task-board/task-store.js';
import { MessageBus } from '../messaging/message-bus.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { BaseAgent } from './base-agent.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('agent-runner');

export class AgentRunner {
  private agents: Map<AgentId, BaseAgent> = new Map();
  private running: Map<AgentId, Promise<void>> = new Map();

  /**
   * Register an agent.
   */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
    logger.info({ agentId: agent.id }, 'Agent registered');
  }

  /**
   * Initialize all registered agents.
   */
  async initAll(): Promise<void> {
    for (const [id, agent] of this.agents) {
      await agent.init();
      logger.info({ agentId: id }, 'Agent initialized');
    }
  }

  /**
   * Start all agents.
   */
  async startAll(): Promise<void> {
    for (const [id, agent] of this.agents) {
      const runPromise = agent.start().catch((error) => {
        logger.error({ agentId: id, error: error.message }, 'Agent crashed');
      });
      this.running.set(id, runPromise);
      logger.info({ agentId: id }, 'Agent started');
    }
  }

  /**
   * Stop all agents.
   */
  async stopAll(): Promise<void> {
    for (const [id, agent] of this.agents) {
      await agent.stop();
      logger.info({ agentId: id }, 'Agent stopped');
    }
    this.running.clear();
  }

  /**
   * Start a specific agent.
   */
  async startAgent(id: AgentId): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }
    const runPromise = agent.start().catch((error) => {
      logger.error({ agentId: id, error: error.message }, 'Agent crashed');
    });
    this.running.set(id, runPromise);
  }

  /**
   * Stop a specific agent.
   */
  async stopAgent(id: AgentId): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }
    await agent.stop();
    this.running.delete(id);
  }

  /**
   * Get status of all agents.
   */
  getAllStatus(): AgentStatus[] {
    return Array.from(this.agents.values()).map((a) => a.getStatus());
  }

  /**
   * Get status of a specific agent.
   */
  getStatus(id: AgentId): AgentStatus | null {
    const agent = this.agents.get(id);
    return agent ? agent.getStatus() : null;
  }

  /**
   * Get a specific agent instance.
   */
  getAgent(id: AgentId): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agent IDs.
   */
  getAgentIds(): AgentId[] {
    return Array.from(this.agents.keys());
  }
}
