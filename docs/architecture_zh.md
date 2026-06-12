# 技术架构

## 系统概述

ArcClaw 是一个基于 [Vercel AI SDK](https://sdk.vercel.ai/) 构建的多智能体编排平台。它管理一个由专业 AI 智能体组成的团队，协同工作，将产品需求转化为经过测试的代码。

```
┌─────────────────────────────────────────────────────────┐
│                     ArcClaw 运行时                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │   CLI    │  │  API     │  │   SSE    │               │
│  │ (cli.ts) │  │ (Express)│  │ (events) │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │             │             │                     │
│       ▼             ▼             ▼                     │
│  ┌─────────────────────────────────────────┐            │
│  │            ArcClaw 类                   │            │
│  │         (src/index.ts)                  │            │
│  └────┬──────────┬──────────┬──────────────┘            │
│       │          │          │                           │
│       ▼          ▼          ▼                           │
│  ┌─────────┐ ┌────────┐ ┌────────────┐                  │
│  │ 智能体  │ │  任务  │ │   消息     │                  │
│  │ 运行器  │ │  存储  │ │   总线     │                  │
│  └────┬────┘ └───┬────┘ └─────┬──────┘                  │
│       │          │            │                         │
│       ▼          ▼            ▼                         │
│  ┌─────────────────────────────────────┐                │
│  │           智能体实例                │                │
│  │  ┌────────┐ ┌────┐ ┌──────┐         │                │
│  │  │  Team  │ │ PD │ │ 前端 │         │                │
│  │  │ Leader │ │    │ │      │         │                │
│  │  └────────┘ └────┘ └──────┘         │                │
│  │  ┌────────┐ ┌────┐                  │                │
│  │  │  后端  │ │ QA │                  │                │
│  │  └────────┘ └────┘                  │                │
│  └─────────────────────────────────────┘                │
│       │                                                 │
│       ▼                                                 │
│  ┌───────────┐  ┌──────────────────┐                    │
│  │   LLM     │  │   工具注册表     │                    │
│  │  提供商   │  │ bash|file|search │                    │
│  └───────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## 核心模块

### 智能体系统 (`src/agent/`)

| 文件 | 职责 |
|------|---------------|
| `base-agent.ts` | 所有智能体的抽象基类。处理 LLM 调用、工具执行、订阅和生命周期。 |
| `agent-runner.ts` | 管理智能体注册、初始化、启动/停止生命周期。 |
| `context-window.ts` | 滑动窗口上下文管理器，裁剪对话历史以保持在 token 预算内。 |
| `agents/team-leader.ts` | 编排器 — 分析需求，分解为任务，分配给工作智能体，监控进度。 |
| `agents/pd-agent.ts` | 产品设计师 — 编写 PRD（产品需求文档）和技术规格。 |
| `agents/frontend-agent.ts` | 前端开发者 — 实现 UI 组件和页面。 |
| `agents/backend-agent.ts` | 后端开发者 — 实现 API、服务和数据模型。 |
| `agents/qa-agent.ts` | QA 工程师 — 编写测试计划、测试用例并运行测试。 |

#### 智能体生命周期

```
init() → start() → [空闲] → onTaskReceived() → 思考中 → 执行工具 → [空闲]
                          → onMessageReceived() → 思考中 → [空闲]
                                                         ↓
                                                      stop()
```

1. **init** — 创建工作空间目录，加载系统提示词，订阅任务/消息事件
2. **start** — 将智能体标记为运行中，处理任何待处理任务
3. **思考中** — 通过 `generateText()` 调用 LLM，携带可用工具
4. **执行工具** — 运行 LLM 请求的工具（bash、文件写入等）
5. **stop** — 取消订阅事件，标记为空闲

### 任务面板 (`src/task-board/`)

| 文件 | 职责 |
|------|---------------|
| `task-store.ts` | 任务和需求的 CRUD 操作。基于文件的 JSON 持久化，带文件锁定。 |
| `task-watcher.ts` | EventEmitter，触发 `task_created`、`task_updated`、`task_status_changed` 事件。 |
| `state-machine.ts` | 验证任务状态变更（例如 `pending → in_progress → completed`）。 |
| `dependency-resolver.ts` | 拓扑排序、循环检测和就绪任务计算。 |

#### 任务状态机

```
          ┌──────────┐
          │ pending   │
          └─────┬────┘
                │ in_progress
                ▼
          ┌──────────┐
    ┌─────│in_progress│─────┐
    │     └──────────┘     │
    │  blocked   completed │ cancelled
    ▼            ▼          ▼
┌────────┐  ┌────────┐  ┌──────────┐
│blocked │  │completed│  │cancelled │
└────────┘  └────────┘  └──────────┘
```

### 消息总线 (`src/messaging/`)

| 文件 | 职责 |
|------|---------------|
| `message-bus.ts` | 中央消息路由。智能体发送消息；总线投递到目标智能体或广播。 |
| `message-store.ts` | 将消息持久化为 JSON 文件。支持已读/未读跟踪。 |
| `message-router.ts` | 根据 `to` 字段路由消息（特定智能体或广播）。 |
| `file-watcher.ts` | 使用 chokidar 监听消息目录中的新文件。 |

#### 消息流

```
智能体 A  →  messageBus.send()  →  messageStore.write()
                                       ↓
                                 fileWatcher 检测到
                                       ↓
                                 messageRouter.route()
                                       ↓
                                 智能体 B onMessageReceived()
```

### 工具系统 (`src/tools/`)

| 文件 | 职责 |
|------|---------------|
| `tool-registry.ts` | 注册表模式 — 工具按名称注册，按智能体检索。 |
| `permissions.ts` | 权限矩阵，定义每个智能体可以使用哪些工具。 |
| `implementations/` | 具体工具实现：`bash-executor`、`file-writer`、`file-editor`、`file-reader`、`code-search`。 |

#### 工具权限矩阵

| 智能体 | bash | file_writer | file_editor | file_reader | code_search |
|-------|------|-------------|-------------|-------------|-------------|
| Team Leader | — | — | — | — | — |
| PD | — | ✓ | — | ✓ | ✓ |
| Frontend | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backend | ✓ | ✓ | ✓ | ✓ | ✓ |
| QA | ✓ | ✓ | — | ✓ | ✓ |

### LLM 提供商系统 (`src/llm/`)

| 文件 | 职责 |
|------|---------------|
| `provider-registry.ts` | `LLMProviderDefinition` 对象的全局注册表。 |
| `provider-factory.ts` | 定义内置提供商（openai、anthropic、deepseek、ollama）并通过注册表查找创建模型实例。 |
| `llm-logger.ts` | 将每次 LLM 调用（输入、输出、token、耗时）记录到磁盘。单例模式。 |

### API 服务器 (`src/api/`)

Express 服务器，包含 REST 端点和 SSE 广播。

| 路由 | 用途 |
|-------|---------|
| `GET /api/health` | 健康检查（含智能体数量） |
| `GET /api/events` | 实时更新的 SSE 端点 |
| `/api/tasks` | 任务 CRUD |
| `/api/requirements` | 提交和管理需求 |
| `/api/agents` | 智能体状态和控制 |
| `/api/messages` | 智能体间消息日志 |
| `/api/llm-logs` | LLM 调用审计追踪 |

### 数据持久化

所有运行时数据以 JSON 文件形式存储在磁盘上（无需数据库）：

```
data/
  tasks/        — {taskId}.json
  messages/     — {messageId}.json
  llm-logs/     — {logId}.json
  audit/        — arcclaw.log（pino 文件传输）
```

文件操作使用 `proper-lockfile` 进行原子写入，使用 `chokidar` 进行目录监听。

### 目录结构

```
arcclaw/
  dist/            — 编译后的 JavaScript + 类型声明
  prompts/         — 智能体系统提示词（.md 文件）
  src/
    agent/         — 智能体系统
    api/           — Express API 服务器
    llm/           — LLM 提供商和日志记录
    messaging/     — 消息总线
    task-board/    — 任务管理
    tools/         — 工具实现
    types/         — TypeScript 类型定义
    utils/         — 共享工具函数
    config.ts      — 配置加载
    bootstrap.ts   — 默认服务装配
    index.ts       — ArcClaw 类 + 公共导出
    cli.ts         — CLI 入口
```
