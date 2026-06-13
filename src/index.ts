import { loadConfig, type AppConfig } from './config.js';
import { bootstrap, type BootstrapResult } from './bootstrap.js';
import { registerBuiltinProviders } from './llm/provider-factory.js';
import { registerProvider, listProviders } from './llm/provider-registry.js';
import { BaseAgent } from './agent/base-agent.js';
import { AgentRunner } from './agent/agent-runner.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { TaskStore } from './task-board/task-store.js';
import { MessageBus } from './messaging/message-bus.js';
import type { LLMProviderDefinition } from './types/llm.js';
import type { Tool } from './types/tool.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('arcclaw');

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

export interface ArcClawOptions {
  /** Partial config that overrides env / file values. */
  config?: Partial<AppConfig>;
  /** Path to a JSON config file. */
  configPath?: string;
  /** Custom LLM providers to register before start. */
  providers?: LLMProviderDefinition[];
  /** Custom agents to register before start. */
  agents?: BaseAgent[];
  /** Custom tools to register before start. */
  tools?: Tool[];
}

// ---------------------------------------------------------------------------
// ArcClaw — main entry class
// ---------------------------------------------------------------------------

export class ArcClaw {
  private options: ArcClawOptions;
  private config!: AppConfig;
  private services: BootstrapResult | null = null;
  private running = false;

  constructor(options: ArcClawOptions = {}) {
    this.options = options;

    // Register built-in providers immediately so they are available
    // even before start() is called.
    registerBuiltinProviders();

    // Register any user-supplied providers
    if (options.providers) {
      for (const p of options.providers) {
        registerProvider(p);
      }
    }
  }

  // ---- lifecycle -----------------------------------------------------------

  /**
   * Start ArcClaw: load config, bootstrap services, start API and agents.
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.config = loadConfig(this.options.config, this.options.configPath);
    logger.info(
      { provider: this.config.llm.provider, model: this.config.llm.model },
      'Configuration loaded'
    );

    this.services = await bootstrap(this.config);

    // Register extra tools supplied by the caller
    if (this.options.tools) {
      for (const tool of this.options.tools) {
        this.services.toolRegistry.register(tool);
      }
    }

    // Register extra agents supplied by the caller
    if (this.options.agents) {
      for (const agent of this.options.agents) {
        this.services.agentRunner.registerAgent(agent);
      }
      // Re-init to pick up newly registered agents
      await this.services.agentRunner.initAll();
    }

    // Start API server
    await this.services.apiServer.start();
    logger.info({ port: this.config.api.port }, 'API server running');

    // Start all agents
    await this.services.agentRunner.startAll();
    logger.info('All agents started');

    this.running = true;

    logger.info('==========================================');
    logger.info('ArcClaw is ready!');
    logger.info(`API: http://localhost:${this.config.api.port}/api/health`);
    logger.info('==========================================');
  }

  /**
   * Gracefully stop ArcClaw.
   */
  async stop(): Promise<void> {
    if (!this.running || !this.services) return;

    logger.info('Shutting down...');
    await this.services.agentRunner.stopAll();
    await this.services.messageBus.shutdown();
    this.running = false;
    this.services = null;
    logger.info('Shutdown complete');
  }

  // ---- registration --------------------------------------------------------

  /** Register a custom LLM provider at runtime. */
  registerProvider(provider: LLMProviderDefinition): void {
    registerProvider(provider);
  }

  /** Register a custom agent (must be done before start). */
  registerAgent(agent: BaseAgent): void {
    if (this.services) {
      this.services.agentRunner.registerAgent(agent);
    } else {
      this.options.agents = [...(this.options.agents ?? []), agent];
    }
  }

  /** Register a custom tool (must be done before start). */
  registerTool(tool: Tool): void {
    if (this.services) {
      this.services.toolRegistry.register(tool);
    } else {
      this.options.tools = [...(this.options.tools ?? []), tool];
    }
  }

  // ---- accessors -----------------------------------------------------------

  getConfig(): AppConfig { return this.config; }
  getTaskStore(): TaskStore | null { return this.services?.taskStore ?? null; }
  getMessageBus(): MessageBus | null { return this.services?.messageBus ?? null; }
  getAgentRunner(): AgentRunner | null { return this.services?.agentRunner ?? null; }
  getToolRegistry(): ToolRegistry | null { return this.services?.toolRegistry ?? null; }
  isRunning(): boolean { return this.running; }
}

// ---------------------------------------------------------------------------
// Re-exports — everything a library consumer might need
// ---------------------------------------------------------------------------

// Config
export { loadConfig } from './config.js';
export type { AppConfig } from './config.js';

// Bootstrap
export { bootstrap } from './bootstrap.js';
export type { BootstrapResult } from './bootstrap.js';

// Agent system
export { BaseAgent } from './agent/base-agent.js';
export { AgentRunner } from './agent/agent-runner.js';
export { ContextWindow } from './agent/context-window.js';
export { ConfigurableAgent } from './agent/agents/configurable-agent.js';

// Task board
export { TaskStore } from './task-board/task-store.js';
export { TaskWatcher } from './task-board/task-watcher.js';
export { canTransition, getValidTransitions } from './task-board/state-machine.js';
export { topologicalSort, wouldCreateCycle, getReadyTasks } from './task-board/dependency-resolver.js';

// Messaging
export { MessageBus } from './messaging/message-bus.js';
export { MessageStore } from './messaging/message-store.js';

// Tools
export { ToolRegistry } from './tools/tool-registry.js';
export { hasPermission, getAllowedTools, TOOL_PERMISSIONS, registerPermissions, getToolPermissionsSnapshot } from './tools/permissions.js';

// LLM
export { createModel, callLLMWithRetry, registerBuiltinProviders } from './llm/provider-factory.js';
export { registerProvider, getProvider, listProviders, hasProvider } from './llm/provider-registry.js';
export { LLMLogger } from './llm/llm-logger.js';

// API
export { createApiServer, SSEBroadcaster } from './api/index.js';

// Types
export type { LLMProviderDefinition, LLMConfig, LLMProviderName, BuiltinProviderName, ChatMessage, ToolCall, ToolDefinition, LLMLogEntry } from './types/llm.js';
export type { AgentId, BuiltinAgentId, DefaultAgentId, AgentState, AgentStatus } from './types/agent.js';
export { BUILTIN_AGENT_IDS, DEFAULT_AGENT_IDS, ALL_AGENT_IDS, AGENT_DISPLAY_NAMES, getRegisteredAgentIds, registerAgentId, updateDisplayName } from './types/agent.js';
export type { AgentRoleConfig } from './types/agent-config.js';
export type { Task, TaskStatus, TaskPriority, Requirement, CreateTaskInput } from './types/task.js';
export type { AgentMessage } from './types/message.js';
export type { Tool, ToolOutput } from './types/tool.js';

// Utils
export { createLogger, getLogger } from './utils/logger.js';
export { generateId } from './utils/id-generator.js';
export { retry } from './utils/retry.js';
