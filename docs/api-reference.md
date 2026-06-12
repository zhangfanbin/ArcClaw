# REST API Reference

Base URL: `http://localhost:3000` (configurable via `API_PORT`).

All responses are JSON. Errors return `{ "error": "message" }` with appropriate HTTP status codes.

---

## Health Check

### `GET /api/health`

Returns system health and agent count.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-06-12T10:00:00.000Z",
  "agents": 5,
  "sse_clients": 2
}
```

---

## Server-Sent Events

### `GET /api/events`

Subscribe to real-time updates. The response is an SSE stream.

**Event types:**

| Event | Payload | Description |
|-------|---------|-------------|
| `task_created` | `Task` | New task created |
| `task_updated` | `Task` | Task modified |
| `task_status_changed` | `{ task, oldStatus, newStatus }` | Task status transition |
| `new_message` | `AgentMessage` | Inter-agent message sent |
| `requirement_submitted` | `{ requirement_id, task_id, title }` | New requirement submitted |
| `requirement_retriggered` | `{ requirement_id, task_id, title, status }` | Requirement re-triggered |

---

## Requirements

### `POST /api/requirements`

Submit a new product requirement. The Team Leader agent will automatically decompose it into tasks.

**Body:**
```json
{
  "title": "User authentication system",
  "description": "Implement login, registration, and password reset...",
  "priority": "high"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Short title |
| `description` | string | yes | Detailed description |
| `priority` | string | no | `critical`, `high`, `medium`, `low` (default: `medium`) |

**Response:** `201 Created`
```json
{
  "id": "req_abc123",
  "task_id": "task_xyz789",
  "title": "User authentication system",
  "description": "...",
  "status": "pending",
  "created_at": "2025-06-12T10:00:00.000Z"
}
```

### `GET /api/requirements`

List all requirements with progress summary.

**Response:**
```json
{
  "requirements": [
    {
      "id": "req_abc123",
      "title": "User authentication system",
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

Get detailed status of a single requirement.

**Response:**
```json
{
  "id": "req_abc123",
  "title": "User authentication system",
  "tasks": [...],
  "progress": {
    "total": 3,
    "completed": 1,
    "percentage": 33
  }
}
```

### `POST /api/requirements/:id/retrigger`

Re-trigger a completed or failed requirement. Creates a new decomposition task for the Team Leader.

**Response:** `201 Created`

---

## Tasks

### `GET /api/tasks`

List tasks with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `in_progress`, `completed`, `blocked`, `cancelled` |
| `assignee` | string | Filter by agent: `team_leader`, `pd`, `frontend`, `backend`, `qa` |
| `requirement_id` | string | Filter by parent requirement |
| `priority` | string | Filter by priority |

**Response:**
```json
{
  "tasks": [{ "id": "...", "title": "...", "status": "in_progress", "assignee": "backend", ... }],
  "total": 5
}
```

### `GET /api/tasks/:id`

Get a single task by ID.

**Response:** Full `Task` object.

### `POST /api/tasks`

Create a task directly (admin override — normally tasks are created by agents).

**Body:** `CreateTaskInput`
```json
{
  "title": "Fix login bug",
  "description": "Users can't log in with special characters",
  "assignee": "backend",
  "priority": "high",
  "requirement_id": "req_abc123"
}
```

### `PATCH /api/tasks/:id`

Update a task. Supports status transitions and field updates.

**Body (status transition):**
```json
{
  "status": "completed",
  "reason": "All tests passing"
}
```

**Body (field update):**
```json
{
  "title": "Updated title",
  "priority": "critical"
}
```

---

## Agents

### `GET /api/agents`

Get status of all agents.

**Response:**
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

Get status of a specific agent.

| Agent ID | Description |
|----------|-------------|
| `team_leader` | Team Leader — orchestration |
| `pd` | PD Agent — product specs |
| `frontend` | Frontend Agent |
| `backend` | Backend Agent |
| `qa` | QA Agent — testing |

### `POST /api/agents/:id/message`

Send a message to a specific agent (used by the dashboard).

**Body:**
```json
{
  "type": "question",
  "subject": "Status update",
  "body": "What is the current progress on the auth module?"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | no | `question`, `answer`, `review_request`, `progress_update`, etc. |
| `subject` | string | no | Message subject |
| `body` | string | no | Message body |
| `metadata` | object | no | Additional data |

---

## Messages

### `GET /api/messages`

List inter-agent messages with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `to` | string | Filter by recipient agent |
| `from` | string | Filter by sender agent |
| `type` | string | Filter by message type |

**Response:**
```json
{
  "messages": [{ "id": "...", "from": "team_leader", "to": "backend", "type": "task_assigned", ... }],
  "total": 10
}
```

---

## LLM Logs

### `GET /api/llm-logs`

List LLM call log entries (most recent first).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max entries to return (max: 200) |
| `offset` | number | 0 | Pagination offset |

**Response:**
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

Get a single LLM call log entry with full input/output details.
