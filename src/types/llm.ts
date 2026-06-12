// LLM provider types

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface LLMRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
}

export interface LLMResponse {
  content: string | null;
  tool_calls: ToolCall[];
  usage: { prompt_tokens: number; completion_tokens: number };
  finish_reason: 'stop' | 'tool_calls' | 'length';
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_call' | 'finish';
  content?: string;
  tool_call?: Partial<ToolCall>;
  finish_reason?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMProvider {
  readonly name: string;
  chat(request: LLMRequest): Promise<LLMResponse>;
  countTokens(text: string): Promise<number>;
}

/** Built-in provider names shipped with ArcClaw. */
export type BuiltinProviderName = 'openai' | 'anthropic' | 'ollama' | 'deepseek';

/**
 * Accepted provider names. Built-in names get autocomplete;
 * any other string is allowed for custom providers registered at runtime.
 */
export type LLMProviderName = BuiltinProviderName | (string & {});

export interface LLMConfig {
  provider: LLMProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  providerOptions?: Record<string, unknown>;
}

/**
 * Definition for an LLM provider that can be registered with ArcClaw.
 * Built-in providers (openai, anthropic, deepseek, ollama) are registered
 * automatically. Use `arcclaw.registerProvider()` to add custom providers.
 */
export interface LLMProviderDefinition {
  /** Unique provider name (e.g. 'openai', 'my-azure') */
  name: string;

  /**
   * Factory that returns a Vercel AI SDK LanguageModel instance.
   */
  createModel(config: {
    model: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, unknown>;
  }): Promise<any>;

  /** Default base URL for this provider (optional). */
  defaultBaseUrl?: string;

  /** Environment variable name that holds the API key (optional). */
  apiKeyEnvVar?: string;

  /** Whether this provider requires an API key. Defaults to true. */
  requiresApiKey?: boolean;
}

// LLM call log entry
export interface LLMLogEntry {
  id: string;
  timestamp: string;
  duration_ms: number;
  agent_id: string;
  requirement_id: string | null;
  task_id: string | null;
  model: string;
  provider: string;
  model_tier: string;
  input_messages: Array<{ role: string; content: string }>;
  output_text: string;
  tool_calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  finish_reason: string;
  max_tokens: number;
  temperature: number;
  error: string | null;
}
