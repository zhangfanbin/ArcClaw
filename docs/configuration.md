# Configuration Reference

ArcClaw uses a layered configuration system. Values are resolved in this priority order:

1. **Programmatic overrides** — passed to `new ArcClaw({ config: {...} })`
2. **Config file** — `arcclaw.config.json` in CWD (or specified via `--config`)
3. **Environment variables** — loaded from `.env` or shell environment
4. **Built-in defaults**

---

## Environment Variables

### LLM Provider

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `openai` | LLM provider name. Built-in: `openai`, `anthropic`, `deepseek`, `ollama`. Custom names are also accepted after registration. |
| `LLM_MODEL` | `gpt-4o` | Primary model used by the Team Leader for orchestration. |
| `LLM_MODEL_FAST` | same as `LLM_MODEL` | Fast model used by worker agents (PD, Frontend, Backend, QA). |
| `LLM_MAX_TOKENS` | `4096` | Maximum tokens per LLM response. |
| `LLM_TEMPERATURE` | `0.7` | Sampling temperature (0.0 – 2.0). |
| `LLM_BASE_URL` | *(provider default)* | Custom base URL for Anthropic or OpenAI-compatible providers. |

### Provider-Specific Keys

| Variable | Provider | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | openai | OpenAI API key |
| `ANTHROPIC_API_KEY` | anthropic | Anthropic API key (also used for DeepSeek via Anthropic API) |
| `ANTHROPIC_AUTH_TOKEN` | anthropic | Alternative Anthropic auth token |
| `DEEPSEEK_API_KEY` | deepseek | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | deepseek | DeepSeek base URL (default: `https://api.deepseek.com/v1`) |
| `OLLAMA_BASE_URL` | ollama | Ollama server URL (default: `http://localhost:11434`) |

### Agent Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MAX_STEPS` | `15` | Maximum tool-calling steps per LLM interaction. |
| `AGENT_CONTEXT_TOKEN_BUDGET` | `100000` | Token budget for the sliding context window. |
| `AGENT_CONCURRENT_TASKS` | `1` | Number of tasks an agent can process simultaneously. |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | Port for the REST API server. |
| `API_HOST` | `0.0.0.0` | Host to bind the API server. |
| `DASHBOARD_PORT` | `5173` | Port for the development dashboard. |

### Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Directory for runtime data (tasks, messages, logs). |
| `WORKSPACE_DIR` | `./workspaces` | Directory for agent workspaces. |
| `PROMPTS_DIR` | *(relative to package)* | Directory containing agent system prompts (`.md` files). |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |

---

## Config File (`arcclaw.config.json`)

Place an `arcclaw.config.json` in your project root:

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

Or specify a custom path:

```bash
arcclaw start --config /path/to/config.json
```

---

## Programmatic Overrides

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

## Sample `.env` File

Run `arcclaw init` to print a sample configuration:

```bash
arcclaw init > .env
```
