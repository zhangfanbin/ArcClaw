# LLM Providers Guide

ArcClaw uses the [Vercel AI SDK](https://sdk.vercel.ai/) as its model abstraction layer. Every provider must return a Vercel AI SDK `LanguageModel` instance from its `createModel` factory.

---

## Built-in Providers

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
LLM_MODEL=gpt-4o
```

Uses `@ai-sdk/openai`. Supports all OpenAI models including GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, and custom fine-tuned models.

**Custom base URL** (for Azure, proxies, etc.):
```env
LLM_BASE_URL=https://your-proxy.com/v1
```

### Anthropic

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
LLM_MODEL=claude-sonnet-4-20250514
```

Uses `@ai-sdk/anthropic`. Supports Claude Sonnet, Claude Opus, Claude Haiku, and other Anthropic models.

### DeepSeek

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-key
LLM_MODEL=deepseek-v4-pro
LLM_MODEL_FAST=deepseek-v4-flash
```

DeepSeek is accessed via its OpenAI-compatible API. Internally, ArcClaw uses `@ai-sdk/openai` with DeepSeek's base URL (`https://api.deepseek.com/v1`).

**Alternative: DeepSeek via Anthropic-compatible API:**
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com/anthropic
LLM_MODEL=deepseek-v4-pro
```

### Ollama (Local)

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
```

Uses `ollama-ai-provider`. No API key required. Make sure Ollama is running locally:

```bash
ollama serve
ollama pull llama3
```

---

## Custom Providers

Register any Vercel AI SDK-compatible provider at runtime.

### Basic Example

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw({
  config: {
    llm: { provider: 'google', model: 'gemini-pro' },
  },
});

app.registerProvider({
  name: 'google',
  apiKeyEnvVar: 'GOOGLE_API_KEY',
  createModel: async ({ model, apiKey }) => {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  },
});

await app.start();
```

### Azure OpenAI Example

```ts
app.registerProvider({
  name: 'azure-openai',
  apiKeyEnvVar: 'AZURE_OPENAI_API_KEY',
  defaultBaseUrl: 'https://your-resource.openai.azure.com',
  createModel: async ({ model, apiKey, baseUrl }) => {
    const { createAzure } = await import('@ai-sdk/azure');
    const azure = createAzure({
      apiKey,
      baseURL: baseUrl,
    });
    return azure(model);
  },
});
```

### Provider Definition Interface

```ts
interface LLMProviderDefinition {
  /** Unique provider name */
  name: string;

  /** Factory that returns a Vercel AI SDK LanguageModel */
  createModel(config: {
    model: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, unknown>;
  }): Promise<any>;

  /** Default base URL (optional) */
  defaultBaseUrl?: string;

  /** Env var name for the API key (optional) */
  apiKeyEnvVar?: string;

  /** Whether an API key is required (default: true) */
  requiresApiKey?: boolean;
}
```

### Standalone Registration

You can also register providers using the standalone function:

```ts
import { registerProvider } from 'arcclaw';

registerProvider({
  name: 'my-provider',
  createModel: async ({ model, apiKey }) => {
    // ...
  },
});
```

### List Registered Providers

```bash
arcclaw providers
```

Or programmatically:

```ts
import { listProviders } from 'arcclaw';
console.log(listProviders()); // ['openai', 'anthropic', 'deepseek', 'ollama', 'my-provider']
```

---

## Model Tiering

ArcClaw supports two model tiers:

- **`LLM_MODEL`** (powerful) — Used by the Team Leader for requirement analysis and orchestration
- **`LLM_MODEL_FAST`** (fast) — Used by worker agents for code generation

This allows you to use an expensive model for reasoning and a cheaper model for execution:

```env
LLM_MODEL=gpt-4o              # Team Leader
LLM_MODEL_FAST=gpt-4o-mini    # Worker agents
```

---

## Error Handling

If a provider is not registered when you try to use it, ArcClaw throws:

```
Unknown LLM provider: "xyz". Available: openai, anthropic, deepseek, ollama.
Register custom providers with arcclaw.registerProvider().
```

If an API key is missing:

```
OPENAI_API_KEY is required for OpenAI provider
```
