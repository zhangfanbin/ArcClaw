# Extending ArcClaw

ArcClaw is designed to be extensible. You can add custom agents, tools, and providers to fit your workflow.

---

## Custom Agents

### Step 1: Extend `BaseAgent`

```ts
import { BaseAgent, type Task, type AgentMessage } from 'arcclaw';

export class DevOpsAgent extends BaseAgent {
  constructor(config, taskStore, messageBus, toolRegistry) {
    super('devops', config, taskStore, messageBus, toolRegistry);
  }

  /** Which model tier to use: 'powerful' or 'fast' */
  getModelTier(): 'fast' {
    return 'fast';
  }

  /** System prompt for this agent */
  async getSystemPrompt(): Promise<string> {
    return `You are a DevOps engineer. You handle deployment, CI/CD pipelines,
and infrastructure tasks.`;
  }

  /** Handle a task assigned to this agent */
  async onTaskReceived(task: Task): Promise<void> {
    const response = await this.think(
      `You have been assigned task: "${task.title}".\n\n${task.description}`
    );
    // Parse response and update task status
  }

  /** Handle a message from another agent */
  async onMessageReceived(message: AgentMessage): Promise<void> {
    await this.think(`Message from ${message.from}: ${message.body}`);
  }
}
```

### Step 2: Register the Agent

```ts
import { ArcClaw } from 'arcclaw';
import { DevOpsAgent } from './agents/devops';

const app = new ArcClaw();

// The agent needs access to core services, so register after start
// or pass it in the constructor options:
await app.start();

const devops = new DevOpsAgent(
  app.getConfig(),
  app.getTaskStore()!,
  app.getMessageBus()!,
  app.getToolRegistry()!
);

app.registerAgent(devops);
```

### Agent Lifecycle Methods

| Method | Called When | Purpose |
|--------|------------|---------|
| `init()` | During bootstrap | Set up workspace, load prompt, subscribe to events |
| `start()` | After init | Begin processing pending tasks |
| `stop()` | On shutdown | Unsubscribe from events |
| `onTaskReceived(task)` | Task assigned to this agent | Process the task |
| `onMessageReceived(msg)` | Message sent to this agent | React to the message |
| `think(prompt, maxSteps?)` | Your code calls it | Send prompt to LLM with tools |

### Using Tools in Agents

Inside `onTaskReceived` or `onMessageReceived`, call `this.think()` to interact with the LLM. Tools registered in the `ToolRegistry` and permitted for this agent (in `permissions.ts`) will be automatically available:

```ts
async onTaskReceived(task: Task) {
  // The LLM can call any tool available to this agent
  const result = await this.think(
    `Deploy the application. Task: ${task.description}`
  );
  await this.updateTaskStatus(task.id, 'completed', result);
}
```

---

## Custom Tools

### Step 1: Implement the `Tool` Interface

```ts
import type { Tool } from 'arcclaw';
import { z } from 'zod';

export const deployTool: Tool = {
  name: 'deploy',
  description: 'Deploy the application to the specified environment',
  parameters: z.object({
    environment: z.enum(['staging', 'production']),
    branch: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const { execSync } = await import('node:child_process');
      const branch = input.branch || 'main';
      execSync(`git checkout ${branch} && npm run deploy:${input.environment}`);
      return { success: true, result: `Deployed ${branch} to ${input.environment}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
```

### Step 2: Register the Tool

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw();
app.registerTool(deployTool);
await app.start();
```

### Step 3: Grant Permissions (Optional)

If you want specific agents to access your tool, update the permission matrix:

```ts
import { TOOL_PERMISSIONS } from 'arcclaw';

// Add 'deploy' tool to the backend agent's permissions
TOOL_PERMISSIONS.backend.push('deploy');
```

### Tool Interface

```ts
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;  // Zod schema for input validation
  execute: (input: any) => Promise<ToolOutput>;
}

interface ToolOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  stdout?: string;
  stderr?: string;
}
```

---

## Custom Providers

See [docs/providers.md](providers.md) for the full provider guide.

Quick example:

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw();

app.registerProvider({
  name: 'cohere',
  createModel: async ({ model, apiKey }) => {
    const { createCohere } = await import('@ai-sdk/cohere');
    return createCohere({ apiKey })(model);
  },
});
```

---

## Custom System Prompts

Create a directory with `.system.md` files matching agent names:

```
my-prompts/
  team-leader.system.md
  pd-agent.system.md
  frontend-agent.system.md
  backend-agent.system.md
  qa-agent.system.md
```

Then configure:

```env
PROMPTS_DIR=./my-prompts
```

Or programmatically:

```ts
const app = new ArcClaw({
  config: {
    paths: { promptsDir: './my-prompts' },
  },
});
```

---

## Putting It All Together

```ts
import { ArcClaw } from 'arcclaw';
import { DevOpsAgent } from './agents/devops';
import { deployTool } from './tools/deploy';

const app = new ArcClaw({
  config: {
    llm: { provider: 'openai', model: 'gpt-4o' },
    paths: { promptsDir: './custom-prompts' },
  },
  providers: [
    {
      name: 'my-azure',
      createModel: async ({ model, apiKey, baseUrl }) => {
        const { createAzure } = await import('@ai-sdk/azure');
        return createAzure({ apiKey, baseURL: baseUrl })(model);
      },
    },
  ],
  tools: [deployTool],
});

await app.start();
```
