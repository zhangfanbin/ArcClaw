# 扩展 ArcClaw

ArcClaw 设计为可扩展的。你可以添加自定义智能体、工具和提供商来适配你的工作流。

---

## 自定义智能体

### 第一步：继承 `BaseAgent`

```ts
import { BaseAgent, type Task, type AgentMessage } from 'arcclaw';

export class DevOpsAgent extends BaseAgent {
  constructor(config, taskStore, messageBus, toolRegistry) {
    super('devops', config, taskStore, messageBus, toolRegistry);
  }

  /** 使用哪个模型层级：'powerful' 或 'fast' */
  getModelTier(): 'fast' {
    return 'fast';
  }

  /** 该智能体的系统提示词 */
  async getSystemPrompt(): Promise<string> {
    return `你是一名 DevOps 工程师。你负责处理部署、CI/CD 流水线
和基础设施任务。`;
  }

  /** 处理分配给该智能体的任务 */
  async onTaskReceived(task: Task): Promise<void> {
    const response = await this.think(
      `你被分配了任务："${task.title}"。\n\n${task.description}`
    );
    // 解析响应并更新任务状态
  }

  /** 处理来自其他智能体的消息 */
  async onMessageReceived(message: AgentMessage): Promise<void> {
    await this.think(`来自 ${message.from} 的消息：${message.body}`);
  }
}
```

### 第二步：注册智能体

```ts
import { ArcClaw } from 'arcclaw';
import { DevOpsAgent } from './agents/devops';

const app = new ArcClaw();

// 智能体需要访问核心服务，因此可以在启动后注册
// 或在构造函数选项中传入：
await app.start();

const devops = new DevOpsAgent(
  app.getConfig(),
  app.getTaskStore()!,
  app.getMessageBus()!,
  app.getToolRegistry()!
);

app.registerAgent(devops);
```

### 智能体生命周期方法

| 方法 | 调用时机 | 用途 |
|--------|------------|---------|
| `init()` | 引导期间 | 设置工作空间，加载提示词，订阅事件 |
| `start()` | init 之后 | 开始处理待处理任务 |
| `stop()` | 关闭时 | 取消订阅事件 |
| `onTaskReceived(task)` | 任务分配给该智能体 | 处理任务 |
| `onMessageReceived(msg)` | 消息发送给该智能体 | 响应消息 |
| `think(prompt, maxSteps?)` | 由你的代码调用 | 将提示词发送给 LLM 并携带工具 |

### 在智能体中使用工具

在 `onTaskReceived` 或 `onMessageReceived` 中，调用 `this.think()` 与 LLM 交互。在 `ToolRegistry` 中注册且对该智能体授权（在 `permissions.ts` 中）的工具将自动可用：

```ts
async onTaskReceived(task: Task) {
  // LLM 可以调用该智能体可用的任何工具
  const result = await this.think(
    `部署应用程序。任务：${task.description}`
  );
  await this.updateTaskStatus(task.id, 'completed', result);
}
```

---

## 自定义工具

### 第一步：实现 `Tool` 接口

```ts
import type { Tool } from 'arcclaw';
import { z } from 'zod';

export const deployTool: Tool = {
  name: 'deploy',
  description: '将应用程序部署到指定环境',
  parameters: z.object({
    environment: z.enum(['staging', 'production']),
    branch: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const { execSync } = await import('node:child_process');
      const branch = input.branch || 'main';
      execSync(`git checkout ${branch} && npm run deploy:${input.environment}`);
      return { success: true, result: `已将 ${branch} 部署到 ${input.environment}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
```

### 第二步：注册工具

```ts
import { ArcClaw } from 'arcclaw';

const app = new ArcClaw();
app.registerTool(deployTool);
await app.start();
```

### 第三步：授予权限（可选）

如果你希望特定智能体能访问你的工具，请更新权限矩阵：

```ts
import { TOOL_PERMISSIONS } from 'arcclaw';

// 将 'deploy' 工具添加到后端智能体的权限中
TOOL_PERMISSIONS.backend.push('deploy');
```

### Tool 接口

```ts
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;  // 用于输入验证的 Zod 模式
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

## 自定义提供商

详见 [docs/providers.md](providers.md) 获取完整的提供商指南。

快速示例：

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

## 自定义系统提示词

创建一个包含 `.system.md` 文件的目录，文件名与智能体名称匹配：

```
my-prompts/
  team-leader.system.md
  pd-agent.system.md
  frontend-agent.system.md
  backend-agent.system.md
  qa-agent.system.md
```

然后配置：

```env
PROMPTS_DIR=./my-prompts
```

或编程式配置：

```ts
const app = new ArcClaw({
  config: {
    paths: { promptsDir: './my-prompts' },
  },
});
```

---

## 综合示例

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
