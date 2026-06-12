# REST API 参考

基础 URL：`http://localhost:3000`（可通过 `API_PORT` 配置）。

所有响应均为 JSON 格式。错误返回 `{ "error": "message" }` 及相应的 HTTP 状态码。

---

## 健康检查

### `GET /api/health`

返回系统健康状况和智能体数量。

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2025-06-12T10:00:00.000Z",
  "agents": 5,
  "sse_clients": 2
}
```

---

## 服务器推送事件

### `GET /api/events`

订阅实时更新。响应为 SSE 流。

**事件类型：**

| 事件 | 数据 | 描述 |
|-------|---------|-------------|
| `task_created` | `Task` | 新任务已创建 |
| `task_updated` | `Task` | 任务已修改 |
| `task_status_changed` | `{ task, oldStatus, newStatus }` | 任务状态变更 |
| `new_message` | `AgentMessage` | 智能体间消息已发送 |
| `requirement_submitted` | `{ requirement_id, task_id, title }` | 新需求已提交 |
| `requirement_retriggered` | `{ requirement_id, task_id, title, status }` | 需求已重新触发 |

---

## 需求

### `POST /api/requirements`

提交新的产品需求。Team Leader 智能体将自动将其分解为任务。

**请求体：**
```json
{
  "title": "用户认证系统",
  "description": "实现登录、注册和密码重置...",
  "priority": "high"
}
```

| 字段 | 类型 | 必填 | 描述 |
|-------|------|----------|-------------|
| `title` | string | 是 | 简短标题 |
| `description` | string | 是 | 详细描述 |
| `priority` | string | 否 | `critical`、`high`、`medium`、`low`（默认：`medium`） |

**响应：** `201 Created`
```json
{
  "id": "req_abc123",
  "task_id": "task_xyz789",
  "title": "用户认证系统",
  "description": "...",
  "status": "pending",
  "created_at": "2025-06-12T10:00:00.000Z"
}
```

### `GET /api/requirements`

列出所有需求及其进度摘要。

**响应：**
```json
{
  "requirements": [
    {
      "id": "req_abc123",
      "title": "用户认证系统",
      "tasks": [{ "id": "...", "title": "...", "assignee": "backend", "status": "completed" }],
      "total_tasks": 3,
      "completed_tasks": 1,
      "status": "in_progress"
    }
  ],
  "total": 1
}
```

### `GET /api/requirements/:id`

获取单个需求的详细状态。

**响应：**
```json
{
  "id": "req_abc123",
  "title": "用户认证系统",
  "tasks": [...],
  "progress": {
    "total": 3,
    "completed": 1,
    "percentage": 33
  }
}
```

### `POST /api/requirements/:id/retrigger`

重新触发已完成或失败的需求。为 Team Leader 创建一个新的分解任务。

**响应：** `201 Created`

---

## 任务

### `GET /api/tasks`

列出任务，支持可选过滤。

**查询参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `status` | string | 按状态过滤：`pending`、`in_progress`、`completed`、`blocked`、`cancelled` |
| `assignee` | string | 按智能体过滤：`team_leader`、`pd`、`frontend`、`backend`、`qa` |
| `requirement_id` | string | 按父需求过滤 |
| `priority` | string | 按优先级过滤 |

**响应：**
```json
{
  "tasks": [{ "id": "...", "title": "...", "status": "in_progress", "assignee": "backend", ... }],
  "total": 5
}
```

### `GET /api/tasks/:id`

按 ID 获取单个任务。

**响应：** 完整的 `Task` 对象。

### `POST /api/tasks`

直接创建任务（管理员覆盖 — 通常任务由智能体创建）。

**请求体：** `CreateTaskInput`
```json
{
  "title": "修复登录 Bug",
  "description": "用户使用特殊字符时无法登录",
  "assignee": "backend",
  "priority": "high",
  "requirement_id": "req_abc123"
}
```

### `PATCH /api/tasks/:id`

更新任务。支持状态变更和字段更新。

**请求体（状态变更）：**
```json
{
  "status": "completed",
  "reason": "所有测试通过"
}
```

**请求体（字段更新）：**
```json
{
  "title": "更新后的标题",
  "priority": "critical"
}
```

---

## 智能体

### `GET /api/agents`

获取所有智能体的状态。

**响应：**
```json
{
  "agents": [
    {
      "id": "team_leader",
      "state": "idle",
      "current_task_id": null,
      "context_usage": 0,
      "last_activity": "2025-06-12T10:00:00.000Z",
      "error": null
    }
  ]
}
```

### `GET /api/agents/:id`

获取特定智能体的状态。

| 智能体 ID | 描述 |
|----------|-------------|
| `team_leader` | Team Leader — 编排调度 |
| `pd` | PD Agent — 产品规格 |
| `frontend` | Frontend Agent — 前端开发 |
| `backend` | Backend Agent — 后端开发 |
| `qa` | QA Agent — 测试 |

### `POST /api/agents/:id/message`

向特定智能体发送消息（由仪表盘使用）。

**请求体：**
```json
{
  "type": "question",
  "subject": "状态更新",
  "body": "认证模块的当前进度如何？"
}
```

| 字段 | 类型 | 必填 | 描述 |
|-------|------|----------|-------------|
| `type` | string | 否 | `question`、`answer`、`review_request`、`progress_update` 等 |
| `subject` | string | 否 | 消息主题 |
| `body` | string | 否 | 消息正文 |
| `metadata` | object | 否 | 附加数据 |

---

## 消息

### `GET /api/messages`

列出智能体间消息，支持可选过滤。

**查询参数：**

| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| `to` | string | 按接收智能体过滤 |
| `from` | string | 按发送智能体过滤 |
| `type` | string | 按消息类型过滤 |

**响应：**
```json
{
  "messages": [{ "id": "...", "from": "team_leader", "to": "backend", "type": "task_assigned", ... }],
  "total": 10
}
```

---

## LLM 日志

### `GET /api/llm-logs`

列出 LLM 调用日志条目（最新优先）。

**查询参数：**

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `limit` | number | 50 | 最大返回条目数（上限：200） |
| `offset` | number | 0 | 分页偏移量 |

**响应：**
```json
{
  "entries": [
    {
      "id": "llm_abc123",
      "timestamp": "2025-06-12T10:00:00.000Z",
      "duration_ms": 3500,
      "agent_id": "team_leader",
      "model": "gpt-4o",
      "provider": "openai",
      "input_tokens": 1200,
      "output_tokens": 500,
      "total_tokens": 1700,
      "error": null
    }
  ],
  "total": 42
}
```

### `GET /api/llm-logs/:id`

获取单条 LLM 调用日志条目，包含完整的输入/输出详情。
