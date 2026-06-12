# 配置参考

ArcClaw 使用分层配置系统。值按以下优先级顺序解析：

1. **编程式覆盖** — 传递给 `new ArcClaw({ config: {...} })`
2. **配置文件** — 当前工作目录下的 `arcclaw.config.json`（或通过 `--config` 指定）
3. **环境变量** — 从 `.env` 或 shell 环境加载
4. **内置默认值**

---

## 环境变量

### LLM 提供商

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `LLM_PROVIDER` | `openai` | LLM 提供商名称。内置：`openai`、`anthropic`、`deepseek`、`ollama`。注册后也可接受自定义名称。 |
| `LLM_MODEL` | `gpt-4o` | Team Leader 用于编排的主模型。 |
| `LLM_MODEL_FAST` | 与 `LLM_MODEL` 相同 | 工作智能体（PD、Frontend、Backend、QA）使用的快速模型。 |
| `LLM_MAX_TOKENS` | `4096` | 每次 LLM 响应的最大 token 数。 |
| `LLM_TEMPERATURE` | `0.7` | 采样温度（0.0 – 2.0）。 |
| `LLM_BASE_URL` | *(提供商默认值)* | Anthropic 或 OpenAI 兼容提供商的自定义 Base URL。 |

### 提供商专用 Key

| 变量 | 提供商 | 描述 |
|----------|----------|-------------|
| `OPENAI_API_KEY` | openai | OpenAI API Key |
| `ANTHROPIC_API_KEY` | anthropic | Anthropic API Key（也用于通过 Anthropic API 访问 DeepSeek） |
| `ANTHROPIC_AUTH_TOKEN` | anthropic | 替代的 Anthropic 认证 Token |
| `DEEPSEEK_API_KEY` | deepseek | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | deepseek | DeepSeek Base URL（默认：`https://api.deepseek.com/v1`） |
| `OLLAMA_BASE_URL` | ollama | Ollama 服务器 URL（默认：`http://localhost:11434`） |

### 智能体设置

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `AGENT_MAX_STEPS` | `15` | 每次 LLM 交互的最大工具调用步数。 |
| `AGENT_CONTEXT_TOKEN_BUDGET` | `100000` | 滑动上下文窗口的 Token 预算。 |
| `AGENT_CONCURRENT_TASKS` | `1` | 智能体可同时处理的任务数。 |

### 服务器

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `API_PORT` | `3000` | REST API 服务器端口。 |
| `API_HOST` | `0.0.0.0` | API 服务器绑定的主机地址。 |
| `DASHBOARD_PORT` | `5173` | 开发仪表盘端口。 |

### 路径

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | 运行时数据目录（任务、消息、日志）。 |
| `WORKSPACE_DIR` | `./workspaces` | 智能体工作空间目录。 |
| `PROMPTS_DIR` | *(相对于包)* | 包含智能体系统提示词（`.md` 文件）的目录。 |

### 日志

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Pino 日志级别：`trace`、`debug`、`info`、`warn`、`error`、`fatal`。 |

---

## 配置文件 (`arcclaw.config.json`)

在项目根目录放置一个 `arcclaw.config.json`：

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "modelFast": "gpt-4o-mini",
    "maxTokens": 8192,
    "temperature": 0.5
  },
  "agents": {
    "maxSteps": 20,
    "contextTokenBudget": 120000
  },
  "api": {
    "port": 4000
  },
  "paths": {
    "dataDir": "/var/arcclaw/data",
    "promptsDir": "./custom-prompts"
  }
}
```

或指定自定义路径：

```bash
arcclaw start --config /path/to/config.json
```

---

## 编程式覆盖

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw({
  config: {
    llm: {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      modelFast: 'deepseek-v4-flash',
      apiKey: process.env.MY_KEY,
    },
    api: { port: 5000 },
  },
});
```

---

## `.env` 文件示例

运行 `arcclaw init` 打印示例配置：

```bash
arcclaw init > .env
```
