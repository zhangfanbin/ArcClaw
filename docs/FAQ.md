# FAQ — Frequently Asked Questions

## General

### What is ArcClaw?

ArcClaw is a multi-agent AI collaboration platform. It runs a team of 5 specialized AI agents (Team Leader, PD, Frontend, Backend, QA) that work together to turn product requirements into working software.

### What Node.js versions are supported?

ArcClaw requires **Node.js >= 18**. It uses ES modules (`"type": "module"`), `import.meta`, and modern APIs.

### Does ArcClaw require a database?

No. All data is persisted as JSON files on disk. No external database is needed.

---

## LLM Providers

### Which LLM providers are supported out of the box?

- **OpenAI** — GPT-4o, GPT-4, etc.
- **Anthropic** — Claude Sonnet, Claude Opus, etc.
- **DeepSeek** — DeepSeek V4 Pro, DeepSeek V4 Flash, etc.
- **Ollama** — Local models like Llama 3, Mistral, Code Llama, etc.

### How do I add a custom LLM provider?

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw();
app.registerProvider({
  name: 'my-provider',
  createModel: async ({ model, apiKey, baseUrl }) => {
    // Return a Vercel AI SDK LanguageModel instance
    const { createMyProvider } = await import('my-provider-sdk');
    return createMyProvider({ apiKey, baseURL: baseUrl })(model);
  },
});
await app.start();
```

See [docs/providers.md](providers.md) for a detailed guide.

### Can I run ArcClaw without an API key?

Yes, if you use **Ollama** (local models). Ollama does not require an API key:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
```

### What is the difference between `LLM_MODEL` and `LLM_MODEL_FAST`?

- `LLM_MODEL` — Used by the **Team Leader** agent for complex reasoning and orchestration. Should be a powerful model.
- `LLM_MODEL_FAST` — Used by **worker agents** (PD, Frontend, Backend, QA) for code generation and analysis. Can be a faster/cheaper model.

Using a tiered approach reduces costs while maintaining quality for orchestration tasks.

### Can I use DeepSeek via the Anthropic-compatible API?

Yes. Set the provider to `anthropic` and point the base URL to DeepSeek's Anthropic endpoint:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-your-deepseek-key
LLM_BASE_URL=https://api.deepseek.com/anthropic
LLM_MODEL=deepseek-v4-pro
```

---

## Configuration

### Where does ArcClaw look for configuration?

ArcClaw resolves config in this priority order:

1. Programmatic overrides (`new ArcClaw({ config: {...} })`)
2. Config file (`arcclaw.config.json` in CWD, or `--config` flag)
3. Environment variables (`.env` file or shell)
4. Built-in defaults

### How do I use custom agent prompts?

Set `PROMPTS_DIR` to a directory containing your custom `.system.md` files:

```env
PROMPTS_DIR=./my-prompts
```

The files must follow the naming convention: `team-leader.system.md`, `pd-agent.system.md`, `frontend-agent.system.md`, `backend-agent.system.md`, `qa-agent.system.md`.

### Where is runtime data stored?

By default, in the `./data` directory relative to your working directory. Override with:

```env
DATA_DIR=/path/to/data
```

---

## Agents & Tools

### Can I add custom agents?

Yes. Extend `BaseAgent` and register with the `ArcClaw` instance:

```ts
import { BaseAgent, ArcClaw } from 'arcclaw';

class MyAgent extends BaseAgent {
  getModelTier() { return 'fast'; }
  async getSystemPrompt() { return 'You are a specialized agent...'; }
  async onTaskReceived(task) { /* handle task */ }
  async onMessageReceived(message) { /* handle message */ }
}

const app = new ArcClaw();
app.registerAgent(new MyAgent(/* ... */));
await app.start();
```

See [docs/extending.md](extending.md) for full details.

### Can I add custom tools?

Yes. Implement the `Tool` interface and register it:

```ts
import { ArcClaw } from 'arcclaw';
import { z } from 'zod';

const myTool = {
  name: 'my_tool',
  description: 'Does something useful',
  parameters: z.object({ input: z.string() }),
  execute: async ({ input }) => ({ success: true, result: 'done' }),
};

const app = new ArcClaw();
app.registerTool(myTool);
await app.start();
```

---

## Dashboard

### How do I run the dashboard?

The dashboard is a separate React app. Clone the repository and run:

```bash
pnpm install
pnpm run dev:all   # Starts backend + dashboard simultaneously
```

### How does the dashboard connect to the API?

The dashboard connects to `http://localhost:3000` by default (configurable via `VITE_API_URL`). It subscribes to the SSE endpoint `/api/events` for real-time updates.

---

## Troubleshooting

### "Unknown LLM provider" error

This means the provider name in your config doesn't match any registered provider. Check:
1. Your `LLM_PROVIDER` value matches a built-in name or a custom provider you registered
2. Run `arcclaw providers` to see all registered providers

### LLM call fails with 401 / 403

Your API key is invalid or expired. Verify:
1. The correct env var is set (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`)
2. The key has not been revoked
3. Your account has sufficient credits

### Agent gets stuck in "thinking" state

This usually means the LLM call timed out or returned an error. Check:
1. `data/audit/arcclaw.log` for detailed error messages
2. `data/llm-logs/` for the failed LLM call record
3. Network connectivity to the LLM API

### Port already in use

Change the API port:

```env
API_PORT=4000
```

Or via CLI: `arcclaw start --port 4000`
