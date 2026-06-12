# LLM 提供商指南

ArcClaw 使用 [Vercel AI SDK](https://sdk.vercel.ai/) 作为其模型抽象层。每个提供商必须从其 `createModel` 工厂函数返回一个 Vercel AI SDK `LanguageModel` 实例。

---

## 内置提供商

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
LLM_MODEL=gpt-4o
```

使用 `@ai-sdk/openai`。支持所有 OpenAI 模型，包括 GPT-4o、GPT-4 Turbo、GPT-3.5 Turbo 以及自定义微调模型。

**自定义 Base URL**（适用于 Azure、代理等）：
```env
LLM_BASE_URL=https://your-proxy.com/v1
```

### Anthropic

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
LLM_MODEL=claude-sonnet-4-20250514
```

使用 `@ai-sdk/anthropic`。支持 Claude Sonnet、Claude Opus、Claude Haiku 和其他 Anthropic 模型。

### DeepSeek

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-key
LLM_MODEL=deepseek-v4-pro
LLM_MODEL_FAST=deepseek-v4-flash
```

DeepSeek 通过其兼容 OpenAI 的 API 访问。内部，ArcClaw 使用 `@ai-sdk/openai` 并指向 DeepSeek 的 Base URL（`https://api.deepseek.com/v1`）。

**替代方案：通过兼容 Anthropic 的 API 访问 DeepSeek：**
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com/anthropic
LLM_MODEL=deepseek-v4-pro
```

### Ollama（本地）

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
```

使用 `ollama-ai-provider`。无需 API Key。确保 Ollama 在本地运行：

```bash
ollama serve
ollama pull llama3
```

---

## 自定义提供商

在运行时注册任何兼容 Vercel AI SDK 的提供商。

### 基础示例

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

### Azure OpenAI 示例

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

### 提供商定义接口

```ts
interface LLMProviderDefinition {
  /** 唯一的提供商名称 */
  name: string;

  /** 返回 Vercel AI SDK LanguageModel 的工厂函数 */
  createModel(config: {
    model: string;
    apiKey?: string;
    baseUrl?: string;
    options?: Record<string, unknown>;
  }): Promise<any>;

  /** 默认 Base URL（可选） */
  defaultBaseUrl?: string;

  /** API Key 的环境变量名（可选） */
  apiKeyEnvVar?: string;

  /** 是否需要 API Key（默认：true） */
  requiresApiKey?: boolean;
}
```

### 独立注册

你也可以使用独立函数注册提供商：

```ts
import { registerProvider } from 'arcclaw';

registerProvider({
  name: 'my-provider',
  createModel: async ({ model, apiKey }) => {
    // ...
  },
});
```

### 列出已注册的提供商

```bash
arcclaw providers
```

或编程式调用：

```ts
import { listProviders } from 'arcclaw';
console.log(listProviders()); // ['openai', 'anthropic', 'deepseek', 'ollama', 'my-provider']
```

---

## 模型分层

ArcClaw 支持两个模型层级：

- **`LLM_MODEL`**（强大） — 由 Team Leader 用于需求分析和编排
- **`LLM_MODEL_FAST`**（快速） — 由工作智能体用于代码生成

这允许你将昂贵的模型用于推理，将便宜的模型用于执行：

```env
LLM_MODEL=gpt-4o              # Team Leader
LLM_MODEL_FAST=gpt-4o-mini    # 工作智能体
```

---

## 错误处理

如果尝试使用未注册的提供商，ArcClaw 会抛出：

```
Unknown LLM provider: "xyz". Available: openai, anthropic, deepseek, ollama.
Register custom providers with arcclaw.registerProvider().
```

如果缺少 API Key：

```
OPENAI_API_KEY is required for OpenAI provider
```
