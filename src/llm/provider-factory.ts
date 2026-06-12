import type { LLMConfig, LLMProviderDefinition } from '../types/llm.js';
import { createLogger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';
import { registerProvider, getProvider, listProviders } from './provider-registry.js';

const logger = createLogger('llm-provider');

// ---------------------------------------------------------------------------
// Dynamic SDK imports (lazy-loaded on first use)
// ---------------------------------------------------------------------------

let openaiModule: any = null;
let anthropicModule: any = null;
let ollamaModule: any = null;

async function getOpenAI() {
  if (!openaiModule) openaiModule = await import('@ai-sdk/openai');
  return openaiModule;
}

async function getAnthropic() {
  if (!anthropicModule) anthropicModule = await import('@ai-sdk/anthropic');
  return anthropicModule;
}

async function getOllama() {
  if (!ollamaModule) ollamaModule = await import('ollama-ai-provider');
  return ollamaModule;
}

// ---------------------------------------------------------------------------
// Built-in provider definitions
// ---------------------------------------------------------------------------

const builtinProviders: LLMProviderDefinition[] = [
  {
    name: 'openai',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    requiresApiKey: true,
    async createModel({ model, apiKey, baseUrl }) {
      if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI provider');
      const { createOpenAI } = await getOpenAI();
      const openai = createOpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
      return openai(model);
    },
  },
  {
    name: 'anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    requiresApiKey: true,
    async createModel({ model, apiKey, baseUrl }) {
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
      const { createAnthropic } = await getAnthropic();
      const anthropic = createAnthropic({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) });
      return anthropic(model);
    },
  },
  {
    name: 'deepseek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    requiresApiKey: true,
    async createModel({ model, apiKey, baseUrl }) {
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required for DeepSeek provider');
      const { createOpenAI } = await getOpenAI();
      const deepseek = createOpenAI({ apiKey, baseURL: baseUrl || 'https://api.deepseek.com/v1' });
      return deepseek(model);
    },
  },
  {
    name: 'ollama',
    defaultBaseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    async createModel({ model, baseUrl }) {
      const { createOllama } = await getOllama();
      const ollama = createOllama({ baseURL: baseUrl || 'http://localhost:11434' });
      return ollama(model);
    },
  },
];

/**
 * Register all built-in providers. Called once during ArcClaw bootstrap.
 * Safe to call multiple times — re-registers (overwrites) the defaults.
 */
export function registerBuiltinProviders(): void {
  for (const provider of builtinProviders) {
    registerProvider(provider);
  }
  logger.info({ providers: builtinProviders.map((p) => p.name) }, 'Built-in providers registered');
}

// ---------------------------------------------------------------------------
// Model creation
// ---------------------------------------------------------------------------

/**
 * Create a Vercel AI SDK LanguageModel instance for the given config.
 * Looks up the provider from the registry.
 */
export async function createModel(config: LLMConfig): Promise<any> {
  const provider = getProvider(config.provider);
  if (!provider) {
    throw new Error(
      `Unknown LLM provider: "${config.provider}". ` +
        `Available: ${listProviders().join(', ')}. ` +
        `Register custom providers with arcclaw.registerProvider().`
    );
  }

  logger.info({ provider: config.provider, model: config.model }, 'Creating LLM model');

  return provider.createModel({
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl ?? provider.defaultBaseUrl,
    options: config.providerOptions,
  });
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

/**
 * Wrapper for LLM calls with retry logic and error handling.
 */
export async function callLLMWithRetry(
  model: any,
  requestFn: () => Promise<any>,
  maxRetries = 3
): Promise<any> {
  return retry(requestFn, {
    maxRetries,
    shouldRetry: (error: any) => {
      const status = error?.status || error?.statusCode;
      if (status === 429 || status >= 500) {
        logger.warn({ status, error: error.message }, 'Retrying LLM call');
        return true;
      }
      return false;
    },
  });
}
