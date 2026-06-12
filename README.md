<p align="center">
  <h1 align="center">🦞 ArcClaw</h1>
  <p align="center"><strong>Multi-agent AI collaboration platform for end-to-end software delivery</strong></p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/ES%20Modules-✔-yellow" alt="ESM">
</p>

ArcClaw runs a team of 5 specialized AI agents — **Team Leader**, **PD**, **Frontend**, **Backend**, **QA** — that collaborate autonomously to turn product requirements into tested, working software. Powered by the [Vercel AI SDK](https://sdk.vercel.ai/).

---

## ✨ Features

- **5 AI agents** working in parallel — orchestration, design, frontend, backend, QA
- **Extensible provider system** — OpenAI, Anthropic, DeepSeek, Ollama, or bring your own
- **Model tiering** — powerful model for reasoning, fast model for code generation
- **CLI + Programmatic API** — use as a CLI tool or integrate into your Node.js app
- **Real-time dashboard** — monitor agents, tasks, and messages via SSE
- **REST API** — submit requirements, manage tasks, query agent status
- **File-based persistence** — no database required, all data stored as JSON
- **File-locking & watchers** — safe concurrent writes with `proper-lockfile` + `chokidar`

---

## 🚀 Quick Start

### Prerequisites

- **Node.js >= 18**
- An LLM API key (or use Ollama for local models)

### Install

```bash
npm install arcclaw
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` — set your LLM provider and API key:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
LLM_MODEL=gpt-4o
LLM_MODEL_FAST=gpt-4o-mini
```

### Start

```bash
npx arcclaw start
```

### Submit a Requirement

```bash
curl -X POST http://localhost:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"title":"User authentication","description":"Login + registration with JWT","priority":"high"}'
```

The Team Leader automatically decomposes the requirement into tasks and assigns them to the appropriate agents.

---

## 🤖 Agent Team

| Agent | Role | Model Tier |
|---|---|---|
| **Team Leader** | Orchestration, requirement decomposition, task assignment | Powerful (`LLM_MODEL`) |
| **PD** | Product specs & PRDs | Fast (`LLM_MODEL_FAST`) |
| **Frontend** | UI components & pages | Fast |
| **Backend** | APIs, services, data models | Fast |
| **QA** | Test plans & execution | Fast |

---

## 🔌 LLM Providers

| Provider | Setup |
|---|---|
| **OpenAI** | `LLM_PROVIDER=openai` · `OPENAI_API_KEY=sk-...` |
| **Anthropic** | `LLM_PROVIDER=anthropic` · `ANTHROPIC_API_KEY=sk-ant-...` |
| **DeepSeek** | `LLM_PROVIDER=deepseek` · `DEEPSEEK_API_KEY=sk-...` |
| **Ollama** | `LLM_PROVIDER=ollama` · No key required (local) |

Add custom providers in code:

```ts
import { ArcClaw } from 'arcclaw';

app.registerProvider({
  name: 'google',
  apiKeyEnvVar: 'GOOGLE_API_KEY',
  createModel: async ({ model, apiKey }) => {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    return createGoogleGenerativeAI({ apiKey })(model);
  },
});
```

---

## 📦 Usage

### CLI

```bash
npx arcclaw start              # Start the agent runtime + API server
npx arcclaw start --port 4000  # Custom port
npx arcclaw providers          # List registered LLM providers
```

### Programmatic API

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw({
  config: {
    llm: { provider: 'openai', model: 'gpt-4o', modelFast: 'gpt-4o-mini' },
    api: { port: 3000 },
  },
});

// Register custom extensions
app.registerTool(myCustomTool);
app.registerProvider(myCustomProvider);

await app.start();
```

---

## ⚙️ Key Configuration

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai` | openai, anthropic, deepseek, ollama |
| `LLM_MODEL` | `gpt-4o` | Team Leader model |
| `LLM_MODEL_FAST` | same | Worker agent model |
| `API_PORT` | `3000` | REST API port |
| `DATA_DIR` | `./data` | Runtime data directory |
| `PROMPTS_DIR` | `./prompts` | Custom agent system prompts |

Config priority: **Programmatic → config file → env vars → defaults**

---

## 📚 Documentation

Full docs available in [`docs/`](docs/):

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System design, core modules, agent lifecycle |
| [Configuration](docs/configuration.md) | All config options, env vars, config file |
| [LLM Providers](docs/providers.md) | Built-in & custom provider setup |
| [API Reference](docs/api-reference.md) | REST endpoints, SSE events |
| [Extending](docs/extending.md) | Custom agents, tools, providers |
| [FAQ](docs/FAQ.md) | Common questions & troubleshooting |

Or open [`docs/index.html`](docs/index.html) for a bilingual (EN/中文) documentation site.

---

## 🛠️ Development

```bash
git clone https://github.com/zhangfanbin/ArcClaw.git
cd ArcClaw
pnpm install

pnpm run dev          # Start runtime in watch mode
pnpm run dashboard    # Start dashboard
pnpm run dev:all      # Both simultaneously
pnpm run test         # Run tests
pnpm run build        # Compile TypeScript
```

---

## 📄 License

MIT © ArcClaw
