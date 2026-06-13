import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { AgentRoleConfig } from '../types/agent-config.js';
import { DEFAULT_AGENT_IDS, AGENT_DISPLAY_NAMES } from '../types/agent.js';
import { getAllowedTools } from '../tools/permissions.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('runtime-init');

/**
 * Resolved runtime paths after initialization.
 */
export interface RuntimePaths {
  arcclawHome: string;
  agentsDir: string;
  dataDir: string;
  auditDir: string;
  llmLogsDir: string;
  tasksDir: string;
  messagesDir: string;
}

/**
 * Default agent metadata used when scaffolding config files for the first time.
 */
const DEFAULT_AGENT_META: Record<string, { displayName: string; description: string; modelTier: 'powerful' | 'fast' }> = {
  pd: {
    displayName: 'PD Agent (Product Manager)',
    description: 'Handles requirement analysis, PRD generation, and user stories',
    modelTier: 'fast',
  },
  frontend: {
    displayName: 'Frontend Agent',
    description: 'Builds React/TypeScript UI components and responsive interfaces',
    modelTier: 'fast',
  },
  backend: {
    displayName: 'Backend Agent',
    description: 'Creates RESTful APIs, business logic, and database schemas',
    modelTier: 'fast',
  },
  qa: {
    displayName: 'QA Agent (Test Engineer)',
    description: 'Creates test plans, writes test cases, and performs quality assessments',
    modelTier: 'fast',
  },
};

/**
 * Resolve the .arcclaw/ root directory path.
 */
function resolveArcclawHome(overrideHome?: string): string {
  return path.resolve(overrideHome || process.env.ARCCLAW_HOME || '.arcclaw');
}

/**
 * Ensure the full .arcclaw/ directory skeleton exists and scaffold default
 * agent configs on first run. Existing files are never overwritten.
 */
export async function initializeRuntime(opts?: { arcclawHome?: string; promptsDir?: string }): Promise<RuntimePaths> {
  const arcclawHome = resolveArcclawHome(opts?.arcclawHome);

  const runtimePaths: RuntimePaths = {
    arcclawHome,
    agentsDir: path.join(arcclawHome, 'agents'),
    dataDir: path.join(arcclawHome, 'data'),
    auditDir: path.join(arcclawHome, 'data', 'audit'),
    llmLogsDir: path.join(arcclawHome, 'data', 'llm-logs'),
    tasksDir: path.join(arcclawHome, 'data', 'tasks'),
    messagesDir: path.join(arcclawHome, 'data', 'messages'),
  };

  logger.info({ arcclawHome }, 'Initializing .arcclaw/ runtime directory');

  // 1. Create all data directories
  for (const dir of [
    runtimePaths.agentsDir,
    runtimePaths.auditDir,
    runtimePaths.llmLogsDir,
    runtimePaths.tasksDir,
    runtimePaths.messagesDir,
  ]) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 2. team_leader — BUILTIN marker (no config.json)
  const teamLeaderDir = path.join(runtimePaths.agentsDir, 'team_leader');
  await fs.mkdir(teamLeaderDir, { recursive: true });
  const builtinMarker = path.join(teamLeaderDir, 'BUILTIN');
  if (!existsSync(builtinMarker)) {
    await fs.writeFile(
      builtinMarker,
      'This agent is built-in and cannot be customized by users.\n',
      'utf-8',
    );
  }

  // 3. Scaffold default customizable agents
  const promptsDir = opts?.promptsDir;
  for (const roleId of DEFAULT_AGENT_IDS) {
    await scaffoldAgentDir(runtimePaths, roleId, promptsDir);
  }

  logger.info({ arcclawHome }, '.arcclaw/ runtime directory ready');
  return runtimePaths;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function scaffoldAgentDir(
  paths: RuntimePaths,
  roleId: string,
  promptsDir?: string,
): Promise<void> {
  const agentDir = path.join(paths.agentsDir, roleId);
  await fs.mkdir(agentDir, { recursive: true });

  const configPath = path.join(agentDir, 'config.json');

  // Only scaffold config.json on first run (do not overwrite user edits)
  if (!existsSync(configPath)) {
    const meta = DEFAULT_AGENT_META[roleId] ?? {
      displayName: roleId,
      description: `Custom ${roleId} agent`,
      modelTier: 'fast' as const,
    };

    const defaultConfig: AgentRoleConfig = {
      id: roleId,
      displayName: AGENT_DISPLAY_NAMES[roleId] || meta.displayName,
      description: meta.description,
      modelTier: meta.modelTier,
      allowedTools: getAllowedTools(roleId),
      systemPromptSource: 'system-prompt.md',
      enabled: true,
    };

    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf-8');
    logger.info({ roleId, configPath }, 'Scaffolded default agent config');
  }

  // Copy system prompt from the shipped prompts/ dir if not yet present
  const promptDest = path.join(agentDir, 'system-prompt.md');
  if (!existsSync(promptDest) && promptsDir) {
    const promptSrc = path.join(promptsDir, `${roleId}-agent.system.md`);
    if (existsSync(promptSrc)) {
      const content = await fs.readFile(promptSrc, 'utf-8');
      await fs.writeFile(promptDest, content, 'utf-8');
      logger.info({ roleId, promptDest }, 'Copied default system prompt');
    }
  }
}
