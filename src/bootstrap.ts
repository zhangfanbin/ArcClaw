import path from 'node:path';
import type { AppConfig } from './config.js';
import { TaskStore } from './task-board/task-store.js';
import { MessageBus } from './messaging/message-bus.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { createBashExecutor } from './tools/implementations/bash-executor.js';
import { createFileWriter } from './tools/implementations/file-writer.js';
import { createFileEditor } from './tools/implementations/file-editor.js';
import { createFileReader } from './tools/implementations/file-reader.js';
import { createCodeSearch } from './tools/implementations/code-search.js';
import { AgentRunner } from './agent/agent-runner.js';
import { TeamLeaderAgent } from './agent/agents/team-leader.js';
import { PdAgent } from './agent/agents/pd-agent.js';
import { FrontendAgent } from './agent/agents/frontend-agent.js';
import { BackendAgent } from './agent/agents/backend-agent.js';
import { QaAgent } from './agent/agents/qa-agent.js';
import { LLMLogger } from './llm/llm-logger.js';
import { setLLMLogger } from './llm/llm-logger.js';
import { createApiServer, SSEBroadcaster, type ApiServer } from './api/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('bootstrap');

/**
 * All runtime services created by the default bootstrap process.
 */
export interface BootstrapResult {
  taskStore: TaskStore;
  messageBus: MessageBus;
  toolRegistry: ToolRegistry;
  agentRunner: AgentRunner;
  llmLogger: LLMLogger;
  sse: SSEBroadcaster;
  apiServer: ApiServer;
}

/**
 * Create and wire all default services, agents, and tools.
 * This is the "batteries-included" bootstrap used by the CLI.
 */
export async function bootstrap(config: AppConfig): Promise<BootstrapResult> {
  const dataDir = path.resolve(config.paths.dataDir);
  const workspaceDir = path.resolve(config.paths.workspaceDir);

  // Task Board
  const taskStore = new TaskStore(dataDir);
  await taskStore.init();
  logger.info('Task store initialized');

  // Message Bus
  const messageBus = new MessageBus(dataDir);
  await messageBus.init();
  logger.info('Message bus initialized');

  // Tool Registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(createBashExecutor(workspaceDir));
  toolRegistry.register(createFileWriter(workspaceDir));
  toolRegistry.register(createFileEditor(workspaceDir));
  toolRegistry.register(createCodeSearch(workspaceDir));
  toolRegistry.register(createFileReader(workspaceDir));
  logger.info('Tool registry initialized');

  // LLM Logger
  const llmLogger = new LLMLogger(dataDir);
  await llmLogger.init();
  setLLMLogger(llmLogger);
  logger.info('LLM logger initialized');

  // Agent Runner
  const agentRunner = new AgentRunner();

  // Register built-in agents
  const teamLeader = new TeamLeaderAgent(config, taskStore, messageBus, toolRegistry);
  const pdAgent = new PdAgent(config, taskStore, messageBus, toolRegistry);
  const frontendAgent = new FrontendAgent(config, taskStore, messageBus, toolRegistry);
  const backendAgent = new BackendAgent(config, taskStore, messageBus, toolRegistry);
  const qaAgent = new QaAgent(config, taskStore, messageBus, toolRegistry);

  agentRunner.registerAgent(teamLeader);
  agentRunner.registerAgent(pdAgent);
  agentRunner.registerAgent(frontendAgent);
  agentRunner.registerAgent(backendAgent);
  agentRunner.registerAgent(qaAgent);
  logger.info('5 agents registered');

  // Initialize agents
  await agentRunner.initAll();
  logger.info('All agents initialized');

  // Start API server
  const sse = new SSEBroadcaster();
  const apiServer = createApiServer({
    taskStore,
    messageBus,
    agentRunner,
    sse,
    llmLogger,
    port: config.api.port,
    host: config.api.host,
  });

  return { taskStore, messageBus, toolRegistry, agentRunner, llmLogger, sse, apiServer };
}
