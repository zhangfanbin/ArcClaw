import path from 'node:path';
import fs from 'node:fs';
import type { LLMProviderName } from './types/llm.js';

export interface AppConfig {
  llm: {
    provider: LLMProviderName;
    model: string;
    modelFast: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens: number;
    temperature: number;
    providerOptions?: Record<string, unknown>;
  };
  agents: {
    maxSteps: number;
    contextTokenBudget: number;
    concurrentTasks: number;
  };
  paths: {
    dataDir: string;
    workspaceDir: string;
    promptsDir: string;
    arcclawHome: string;
  };
  api: {
    port: number;
    host: string;
  };
  dashboard: {
    port: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

/**
 * Deep-merge two objects. `source` values overwrite `target` values.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== undefined && sv !== null && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object') {
      result[key] = deepMerge(tv as any, sv as any);
    } else if (sv !== undefined) {
      result[key] = sv as any;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Default prompts directory — resolves relative to the compiled package
// so that `prompts/` shipped in the npm tarball is found automatically.
// ---------------------------------------------------------------------------

function getDefaultPromptsDir(): string {
  // import.meta.dirname is available in Node 21+.
  // Fallback: derive from __dirname or fileURLToPath.
  const dir =
    typeof (import.meta as any).dirname === 'string'
      ? (import.meta as any).dirname
      : path.dirname(new URL(import.meta.url).pathname);
  return path.resolve(dir, '..', 'prompts');
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function getDefaults(): AppConfig {
  const arcclawHome = process.env.ARCCLAW_HOME || '.arcclaw';
  return {
    llm: {
      provider: 'openai' as LLMProviderName,
      model: 'gpt-4o',
      modelFast: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.7,
    },
    agents: {
      maxSteps: 15,
      contextTokenBudget: 100_000,
      concurrentTasks: 1,
    },
    paths: {
      dataDir: path.join(arcclawHome, 'data'),
      workspaceDir: arcclawHome,
      promptsDir: getDefaultPromptsDir(),
      arcclawHome,
    },
    api: { port: 3000, host: '0.0.0.0' },
    dashboard: { port: 5173 },
  };
}

// ---------------------------------------------------------------------------
// Config-file loader (JSON)
// ---------------------------------------------------------------------------

function loadConfigFile(configPath?: string): Partial<AppConfig> {
  const candidates = configPath
    ? [configPath]
    : ['arcclaw.config.json', 'arcclaw.config.js'];

  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (fs.existsSync(resolved)) {
      try {
        if (resolved.endsWith('.json')) {
          const raw = fs.readFileSync(resolved, 'utf-8');
          return JSON.parse(raw) as Partial<AppConfig>;
        }
        // For .js configs, users would need to use programmatic overrides instead.
      } catch {
        // Ignore malformed config files — fall through to next candidate.
      }
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Env-var loader
// ---------------------------------------------------------------------------

function loadFromEnv(): Partial<AppConfig> {
  const provider = (process.env.LLM_PROVIDER || undefined) as LLMProviderName | undefined;
  if (!provider) return {};

  // Resolve API key based on provider
  let apiKey: string | undefined;
  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      break;
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
      break;
    case 'deepseek':
      apiKey = process.env.DEEPSEEK_API_KEY;
      break;
    case 'ollama':
      apiKey = undefined;
      break;
    default:
      apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
      break;
  }

  const arcclawHome = process.env.ARCCLAW_HOME || '.arcclaw';

  return {
    llm: {
      provider,
      model: getEnv('LLM_MODEL', 'gpt-4o'),
      modelFast: getEnv('LLM_MODEL_FAST', getEnv('LLM_MODEL', 'gpt-4o')),
      apiKey,
      baseUrl:
        provider === 'ollama'
          ? getEnv('OLLAMA_BASE_URL', 'http://localhost:11434')
          : provider === 'deepseek'
            ? getEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
            : process.env.LLM_BASE_URL,
      maxTokens: getEnvInt('LLM_MAX_TOKENS', 4096),
      temperature: parseFloat(getEnv('LLM_TEMPERATURE', '0.7')),
    },
    agents: {
      maxSteps: getEnvInt('AGENT_MAX_STEPS', 15),
      contextTokenBudget: getEnvInt('AGENT_CONTEXT_TOKEN_BUDGET', 100_000),
      concurrentTasks: getEnvInt('AGENT_CONCURRENT_TASKS', 1),
    },
    paths: {
      dataDir: getEnv('DATA_DIR', path.join(arcclawHome, 'data')),
      workspaceDir: getEnv('WORKSPACE_DIR', arcclawHome),
      promptsDir: getEnv('PROMPTS_DIR', getDefaultPromptsDir()),
      arcclawHome,
    },
    api: {
      port: getEnvInt('API_PORT', 3000),
      host: getEnv('API_HOST', '0.0.0.0'),
    },
    dashboard: {
      port: getEnvInt('DASHBOARD_PORT', 5173),
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the full application configuration by merging (lowest → highest priority):
 *   defaults → config file → environment variables → programmatic overrides
 */
export function loadConfig(overrides?: Partial<AppConfig>, configPath?: string): AppConfig {
  const defaults = getDefaults();
  const fileConfig = loadConfigFile(configPath);
  const envConfig = loadFromEnv();

  let config = deepMerge(defaults, fileConfig);
  config = deepMerge(config, envConfig as any);
  if (overrides) {
    config = deepMerge(config, overrides as any);
  }
  return config;
}
