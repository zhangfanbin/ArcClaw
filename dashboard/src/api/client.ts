const API_BASE = '/api';

// Task types
export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  requirement_id: string;
  artifacts: string[];
  created_at: string;
  updated_at: string;
  status_history: any[];
}

export interface AgentStatus {
  id: string;
  state: 'idle' | 'thinking' | 'executing_tool' | 'waiting' | 'error';
  current_task_id: string | null;
  context_usage: number;
  last_activity: string;
  error: string | null;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: string;
  subject: string;
  body: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

export interface Requirement {
  id: string;
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    assignee: string | null;
    status: string;
  }>;
  total_tasks: number;
  completed_tasks: number;
  status: string;
}

export interface LLMLogEntry {
  id: string;
  timestamp: string;
  duration_ms: number;
  agent_id: string;
  requirement_id: string | null;
  task_id: string | null;
  model: string;
  provider: string;
  model_tier: string;
  input_messages: Array<{ role: string; content: string }>;
  output_text: string;
  tool_calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  finish_reason: string;
  max_tokens: number;
  temperature: number;
  error: string | null;
}

// Helper: parse response with error handling
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// API client
export const api = {
  async getTasks(filters?: Record<string, string>): Promise<{ tasks: Task[]; total: number }> {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/tasks?${params}`);
    return parseResponse(res);
  },

  async getTask(id: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    return parseResponse(res);
  },

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse(res);
  },

  async getAgents(): Promise<{ agents: AgentStatus[] }> {
    const res = await fetch(`${API_BASE}/agents`);
    return parseResponse(res);
  },

  async getMessages(filters?: Record<string, string>): Promise<{ messages: Message[]; total: number }> {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/messages?${params}`);
    return parseResponse(res);
  },

  async submitRequirement(data: { title: string; description: string; priority?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse(res);
  },

  async getRequirements(): Promise<{ requirements: Requirement[]; total: number }> {
    const res = await fetch(`${API_BASE}/requirements`);
    return parseResponse(res);
  },

  async retriggerRequirement(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/requirements/${id}/retrigger`, {
      method: 'POST',
    });
    return parseResponse(res);
  },

  async getLLMLogs(limit = 50, offset = 0): Promise<{ entries: LLMLogEntry[]; total: number }> {
    const res = await fetch(`${API_BASE}/llm-logs?limit=${limit}&offset=${offset}`);
    return parseResponse(res);
  },

  async getLLMLog(id: string): Promise<LLMLogEntry> {
    const res = await fetch(`${API_BASE}/llm-logs/${id}`);
    return parseResponse(res);
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/health`);
    return parseResponse(res);
  },
};
