import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { AppConfig } from './config.js';
import type { AgentRoleConfig } from './types/agent-config.js';
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
import { ConfigurableAgent } from './agent/agents/configurable-agent.js';
import { LLMLogger } from './llm/llm-logger.js';
import { setLLMLogger } from './llm/llm-logger.js';
import { createApiServer, SSEBroadcaster, type ApiServer } from './api/index.js';
import { initializeRuntime } from './init/runtime-init.js';
import { setAuditDir } from './utils/logger.js';
import { createLogger } from './utils/logger.js';
import { registerPermissions } from './tools/permissions.js';
import {
  DEFAULT_AGENT_IDS,
  BUILTIN_AGENT_IDS,
  registerAgentId,
  updateDisplayName,
} from './types/agent.js';

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
 * Map of built-in customizable agent IDs to their factory functions.
 */
const BUILTIN_AGENT_FACTORIES: Record<
  string,
  (config: AppConfig, taskStore: TaskStore, messageBus: MessageBus, toolRegistry: ToolRegistry, roleConfig?: AgentRoleConfig) => any
> = {
  pd: (config, ts, mb, tr, rc) => new PdAgent(config, ts, mb, tr, rc),
  frontend: (config, ts, mb, tr, rc) => new FrontendAgent(config, ts, mb, tr, rc),
  backend: (config, ts, mb, tr, rc) => new BackendAgent(config, ts, mb, tr, rc),
  qa: (config, ts, mb, tr, rc) => new QaAgent(config, ts, mb, tr, rc),
};

/**
 * Create and wire all default services, agents, and tools.
 * This is the "batteries-included" bootstrap used by the CLI.
 */
export async function bootstrap(config: AppConfig): Promise<BootstrapResult> {
  // 1. Initialize .arcclaw/ runtime directory structure
  const runtimePaths = await initializeRuntime({
    arcclawHome: config.paths.arcclawHome,
    promptsDir: config.paths.promptsDir,
  });

  // 2. Point logger to the audit directory
  setAuditDir(runtimePaths.auditDir);

  const dataDir = runtimePaths.dataDir;
  const workspaceDir = config.paths.workspaceDir;

  logger.info({ workspaceDir, arcclawHome: runtimePaths.arcclawHome }, 'Runtime paths');

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

  // --- Register team_leader (built-in, not customizable) ---
  const teamLeader = new TeamLeaderAgent(config, taskStore, messageBus, toolRegistry);
  agentRunner.registerAgent(teamLeader);

  // --- Register built-in customizable agents (pd, frontend, backend, qa) ---
  for (const roleId of DEFAULT_AGENT_IDS) {
    const roleConfig = await readAgentConfig(runtimePaths.agentsDir, roleId);

    // Skip if explicitly disabled
    if (roleConfig && roleConfig.enabled === false) {
      logger.info({ roleId }, 'Agent disabled via config, skipping');
      continue;
    }

    // Apply config overrides to display name
    if (roleConfig?.displayName) {
      updateDisplayName(roleId, roleConfig.displayName);
    }

    // Override tool permissions if specified
    if (roleConfig?.allowedTools) {
      registerPermissions(roleId, roleConfig.allowedTools);
    }

    const factory = BUILTIN_AGENT_FACTORIES[roleId];
    if (factory) {
      const agent = factory(config, taskStore, messageBus, toolRegistry, roleConfig ?? undefined);
      agentRunner.registerAgent(agent);
      logger.info({ roleId, hasConfig: !!roleConfig }, 'Built-in agent registered');
    }
  }

  // --- Register user-defined custom agents ---
  const allBuiltinIds: Set<string> = new Set([...BUILTIN_AGENT_IDS, ...DEFAULT_AGENT_IDS]);
  const agentDirs = await fs.readdir(runtimePaths.agentsDir);

  for (const dirName of agentDirs) {
    if (allBuiltinIds.has(dirName)) continue;

    const roleConfig = await readAgentConfig(runtimePaths.agentsDir, dirName);
    if (!roleConfig) continue;
    if (roleConfig.enabled === false) {
      logger.info({ roleId: dirName }, 'Custom agent disabled via config, skipping');
      continue;
    }

    // Load system prompt
    const systemPrompt = await loadSystemPrompt(
      runtimePaths.agentsDir,
      dirName,
      roleConfig,
      config.paths.promptsDir,
    );

    // Register permissions
    registerPermissions(dirName, roleConfig.allowedTools ?? []);

    // Register agent ID and display name
    registerAgentId(dirName);
    if (roleConfig.displayName) {
      updateDisplayName(dirName, roleConfig.displayName);
    }

    const agent = new ConfigurableAgent(
      roleConfig,
      systemPrompt,
      config,
      taskStore,
      messageBus,
      toolRegistry,
    );
    agentRunner.registerAgent(agent);
    logger.info({ roleId: dirName, displayName: roleConfig.displayName }, 'Custom agent registered');
  }

  // Initialize all agents
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readAgentConfig(
  agentsDir: string,
  roleId: string,
): Promise<AgentRoleConfig | null> {
  const configPath = path.join(agentsDir, roleId, 'config.json');
  if (!existsSync(configPath)) return null;

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw) as AgentRoleConfig;
  } catch (err: any) {
    logger.error({ roleId, error: err.message }, 'Failed to read agent config');
    return null;
  }
}

async function loadSystemPrompt(
  agentsDir: string,
  roleId: string,
  roleConfig: AgentRoleConfig,
  defaultPromptsDir: string,
): Promise<string> {
  // 1. Try the agent's own directory
  if (roleConfig.systemPromptSource) {
    const customPath = path.join(agentsDir, roleId, roleConfig.systemPromptSource);
    try {
      return await fs.readFile(customPath, 'utf-8');
    } catch { /* fall through */ }
  }

  // 2. Try shipped prompts/
  const shippedPath = path.join(defaultPromptsDir, `${roleId}-agent.system.md`);
  try {
    return await fs.readFile(shippedPath, 'utf-8');
  } catch { /* fall through */ }

  // 3. Inline fallback
  return `You are the ${roleConfig.displayName ?? roleId} agent. ${roleConfig.description ?? ''}`;
}
