# Technical Architecture

## System Overview

ArcClaw is a multi-agent orchestration platform built on the [Vercel AI SDK](https://sdk.vercel.ai/). It manages a team of specialized AI agents that collaborate to deliver software from product requirements to tested code.

```
┌─────────────────────────────────────────────────────────┐
│                     ArcClaw Runtime                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │   CLI    │  │  API     │  │   SSE    │               │
│  │ (cli.ts) │  │ (Express)│  │ (events) │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │             │             │                     │
│       ▼             ▼             ▼                     │
│  ┌─────────────────────────────────────────┐            │
│  │            ArcClaw Class                │            │
│  │         (src/index.ts)                  │            │
│  └────┬──────────┬──────────┬──────────────┘            │
│       │          │          │                           │
│       ▼          ▼          ▼                           │
│  ┌─────────┐ ┌────────┐ ┌────────────┐                  │
│  │ Agent   │ │  Task  │ │  Message   │                  │
│  │ Runner  │ │  Store │ │   Bus      │                  │
│  └────┬────┘ └───┬────┘ └─────┬──────┘                  │
│       │          │            │                         │
│       ▼          ▼            ▼                         │
│  ┌─────────────────────────────────────┐                │
│  │           Agent Instances           │                │
│  │  ┌────────┐ ┌────┐ ┌──────┐         │                │
│  │  │  Team  │ │ PD │ │Front │         │                │
│  │  │ Leader │ │    │ │end   │         │                │
│  │  └────────┘ └────┘ └──────┘         │                │
│  │  ┌────────┐ ┌────┐                  │                │
│  │  │Backend │ │ QA │                  │                │
│  │  └────────┘ └────┘                  │                │
│  └─────────────────────────────────────┘                │
│       │                                                 │
│       ▼                                                 │
│  ┌───────────┐  ┌──────────────────┐                    │
│  │   LLM     │  │   Tool Registry  │                    │
│  │ Providers │  │ bash|file|search │                    │
│  └───────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Core Modules

### Agent System (`src/agent/`)

| File | Responsibility |
|------|---------------|
| `base-agent.ts` | Abstract base class for all agents. Handles LLM calls, tool execution, subscriptions, and lifecycle. |
| `agent-runner.ts` | Manages agent registration, initialization, start/stop lifecycle. |
| `context-window.ts` | Sliding window context manager that trims conversation history to stay within token budgets. |
| `agents/team-leader.ts` | Orchestrator — analyzes requirements, decomposes into tasks, assigns to workers, monitors progress. |
| `agents/pd-agent.ts` | Product Designer — writes PRDs (Product Requirement Documents) and technical specs. |
| `agents/frontend-agent.ts` | Frontend Developer — implements UI components and pages. |
| `agents/backend-agent.ts` | Backend Developer — implements APIs, services, and data models. |
| `agents/qa-agent.ts` | QA Engineer — writes test plans, test cases, and runs tests. |

#### Agent Lifecycle

```
init() → start() → [idle] → onTaskReceived() → thinking → executing_tool → [idle]
                          → onMessageReceived() → thinking → [idle]
                                                    ↓
                                                  stop()
```

1. **init** — Creates workspace directory, loads system prompt, subscribes to task/message events
2. **start** — Marks agent as running, processes any pending tasks
3. **thinking** — Calls the LLM via `generateText()` with available tools
4. **executing_tool** — Runs a tool (bash, file write, etc.) requested by the LLM
5. **stop** — Unsubscribes from events, marks as idle

### Task Board (`src/task-board/`)

| File | Responsibility |
|------|---------------|
| `task-store.ts` | CRUD operations for tasks and requirements. File-based JSON persistence with file locking. |
| `task-watcher.ts` | EventEmitter that fires `task_created`, `task_updated`, `task_status_changed` events. |
| `state-machine.ts` | Validates task status transitions (e.g., `pending → in_progress → completed`). |
| `dependency-resolver.ts` | Topological sort, cycle detection, and ready-task computation. |

#### Task State Machine

```
          ┌──────────┐
          │ pending   │
          └─────┬────┘
                │ in_progress
                ▼
          ┌──────────┐
    ┌─────│in_progress│─────┐
    │     └──────────┘     │
    │ blocked    completed  │ cancelled
    ▼            ▼          ▼
┌────────┐  ┌────────┐  ┌──────────┐
│ blocked │  │completed│  │cancelled │
└────────┘  └────────┘  └──────────┘
```

### Message Bus (`src/messaging/`)

| File | Responsibility |
|------|---------------|
| `message-bus.ts` | Central message routing. Agents send messages; bus delivers to target agent or broadcasts. |
| `message-store.ts` | Persists messages as JSON files. Supports read/unread tracking. |
| `message-router.ts` | Routes messages based on `to` field (specific agent or broadcast). |
| `file-watcher.ts` | Watches the messages directory for new files using chokidar. |

#### Message Flow

```
Agent A  →  messageBus.send()  →  messageStore.write()
                                    ↓
                              fileWatcher detects
                                    ↓
                              messageRouter.route()
                                    ↓
                              Agent B onMessageReceived()
```

### Tool System (`src/tools/`)

| File | Responsibility |
|------|---------------|
| `tool-registry.ts` | Registry pattern — tools are registered by name and retrieved per-agent. |
| `permissions.ts` | Permission matrix defining which tools each agent can use. |
| `implementations/` | Concrete tool implementations: `bash-executor`, `file-writer`, `file-editor`, `file-reader`, `code-search`. |

#### Tool Permission Matrix

| Agent | bash | file_writer | file_editor | file_reader | code_search |
|-------|------|-------------|-------------|-------------|-------------|
| Team Leader | — | — | — | — | — |
| PD | — | ✓ | — | ✓ | ✓ |
| Frontend | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backend | ✓ | ✓ | ✓ | ✓ | ✓ |
| QA | ✓ | ✓ | — | ✓ | ✓ |

### LLM Provider System (`src/llm/`)

| File | Responsibility |
|------|---------------|
| `provider-registry.ts` | Global registry for `LLMProviderDefinition` objects. |
| `provider-factory.ts` | Defines built-in providers (openai, anthropic, deepseek, ollama) and creates model instances via registry lookup. |
| `llm-logger.ts` | Logs every LLM call (input, output, tokens, duration) to disk. Singleton pattern. |

### API Server (`src/api/`)

Express server with REST endpoints and SSE broadcasting.

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Health check with agent count |
| `GET /api/events` | SSE endpoint for real-time updates |
| `/api/tasks` | CRUD for tasks |
| `/api/requirements` | Submit and manage requirements |
| `/api/agents` | Agent status and control |
| `/api/messages` | Inter-agent message log |
| `/api/llm-logs` | LLM call audit trail |

### Data Persistence

All runtime data is stored as JSON files on disk (no database required):

```
data/
  tasks/        — {taskId}.json
  messages/     — {messageId}.json
  llm-logs/     — {logId}.json
  audit/        — arcclaw.log (pino file transport)
```

File operations use `proper-lockfile` for atomic writes and `chokidar` for directory watching.

### Directory Structure

```
arcclaw/
  dist/            — Compiled JavaScript + declarations
  prompts/         — Agent system prompts (.md files)
  src/
    agent/         — Agent system
    api/           — Express API server
    llm/           — LLM providers and logging
    messaging/     — Message bus
    task-board/    — Task management
    tools/         — Tool implementations
    types/         — TypeScript type definitions
    utils/         — Shared utilities
    config.ts      — Configuration loading
    bootstrap.ts   — Default service wiring
    index.ts       — ArcClaw class + public exports
    cli.ts         — CLI entry point
```
