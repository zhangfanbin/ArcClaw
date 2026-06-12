# 常见问题

## 概述

### ArcClaw 是什么？

ArcClaw 是一个多智能体 AI 协作平台。它运行一个由 5 个专业 AI 智能体（Team Leader、PD、Frontend、Backend、QA）组成的团队，协同工作，将产品需求转化为可运行的软件。

### 支持哪些 Node.js 版本？

ArcClaw 要求 **Node.js >= 18**。它使用 ES 模块（`"type": "module"`）、`import.meta` 和现代 API。

### ArcClaw 需要数据库吗？

不需要。所有数据以 JSON 文件形式持久化存储在磁盘上，无需外部数据库。

---

## LLM 提供商

### 开箱即用支持哪些 LLM 提供商？

- **OpenAI** — GPT-4o、GPT-4 等
- **Anthropic** — Claude Sonnet、Claude Opus 等
- **DeepSeek** — DeepSeek V4 Pro、DeepSeek V4 Flash 等
- **Ollama** — 本地模型，如 Llama 3、Mistral、Code Llama 等

### 如何添加自定义 LLM 提供商？

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw();
app.registerProvider({
  name: 'my-provider',
  createModel: async ({ model, apiKey, baseUrl }) => {
    // 返回一个 Vercel AI SDK LanguageModel 实例
    const { createMyProvider } = await import('my-provider-sdk');
    return createMyProvider({ apiKey, baseURL: baseUrl })(model);
  },
});
await app.start();
```

详见 [docs/providers.md](providers.md)。

### 可以在没有 API Key 的情况下运行 ArcClaw 吗？

可以，如果你使用 **Ollama**（本地模型）。Ollama 不需要 API Key：

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
```

### `LLM_MODEL` 和 `LLM_MODEL_FAST` 有什么区别？

- `LLM_MODEL` — 由 **Team Leader** 智能体使用，用于复杂推理和编排。应使用强大的模型。
- `LLM_MODEL_FAST` — 由 **工作智能体**（PD、Frontend、Backend、QA）使用，用于代码生成和分析。可以使用更快/更便宜的模型。

采用分层策略可以在保持编排质量的同时降低成本。

### 可以通过兼容 Anthropic 的 API 使用 DeepSeek 吗？

可以。将 provider 设置为 `anthropic`，并将 base URL 指向 DeepSeek 的 Anthropic 端点：

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com/anthropic
LLM_MODEL=deepseek-v4-pro
```

---

## 配置

### ArcClaw 在哪里查找配置？

ArcClaw 按以下优先级顺序解析配置：

1. 编程式覆盖（`new ArcClaw({ config: {...} })`）
2. 配置文件（当前工作目录下的 `arcclaw.config.json`，或通过 `--config` 指定）
3. 环境变量（`.env` 文件或 shell 环境）
4. 内置默认值

### 如何使用自定义智能体提示词？

将 `PROMPTS_DIR` 设置为包含自定义 `.system.md` 文件的目录：

```env
PROMPTS_DIR=./my-prompts
```

文件必须遵循命名约定：`team-leader.system.md`、`pd-agent.system.md`、`frontend-agent.system.md`、`backend-agent.system.md`、`qa-agent.system.md`。

### 运行时数据存储在哪里？

默认情况下，存储在相对于工作目录的 `./data` 目录中。可通过以下方式覆盖：

```env
DATA_DIR=/path/to/data
```

---

## 智能体与工具

### 可以添加自定义智能体吗？

可以。继承 `BaseAgent` 并注册到 `ArcClaw` 实例：

```ts
import { BaseAgent, ArcClaw } from 'arcclaw';

class MyAgent extends BaseAgent {
  getModelTier() { return 'fast'; }
  async getSystemPrompt() { return '你是一个专业的智能体...'; }
  async onTaskReceived(task) { /* 处理任务 */ }
  async onMessageReceived(message) { /* 处理消息 */ }
}

const app = new ArcClaw();
app.registerAgent(new MyAgent(/* ... */));
await app.start();
```

详见 [docs/extending.md](extending.md)。

### 可以添加自定义工具吗？

可以。实现 `Tool` 接口并注册：

```ts
import { ArcClaw } from 'arcclaw';
import { z } from 'zod';

const myTool = {
  name: 'my_tool',
  description: '做一些有用的事情',
  parameters: z.object({ input: z.string() }),
  execute: async ({ input }) => ({ success: true, result: '完成' }),
};

const app = new ArcClaw();
app.registerTool(myTool);
await app.start();
```

---

## 仪表盘

### 如何运行仪表盘？

仪表盘是一个独立的 React 应用。克隆仓库后运行：

```bash
pnpm install
pnpm run dev:all   # 同时启动后端 + 仪表盘
```

### 仪表盘如何连接到 API？

仪表盘默认连接到 `http://localhost:3000`（可通过 `VITE_API_URL` 配置）。它通过 SSE 端点 `/api/events` 订阅实时更新。

---

## 故障排查

### "Unknown LLM provider" 错误

这意味着配置中的 provider 名称与任何已注册的 provider 不匹配。请检查：
1. 你的 `LLM_PROVIDER` 值与内置名称或你注册的自定义 provider 匹配
2. 运行 `arcclaw providers` 查看所有已注册的 provider

### LLM 调用失败，返回 401 / 403

你的 API Key 无效或已过期。请核实：
1. 设置了正确的环境变量（如 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPSEEK_API_KEY`）
2. Key 未被吊销
3. 你的账户有足够的额度

### 智能体卡在"思考"状态

这通常意味着 LLM 调用超时或返回错误。请检查：
1. `data/audit/arcclaw.log` 中的详细错误信息
2. `data/llm-logs/` 中的失败 LLM 调用记录
3. 到 LLM API 的网络连接

### 端口已被占用

更改 API 端口：

```env
API_PORT=4000
```

或通过 CLI：`arcclaw start --port 4000`
