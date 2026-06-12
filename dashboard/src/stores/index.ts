import { create } from 'zustand';
import type { Task, AgentStatus, Message, Requirement } from '../api/client';

interface TaskStore {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
}

interface AgentStore {
  agents: AgentStatus[];
  setAgents: (agents: AgentStatus[]) => void;
  updateAgent: (agent: AgentStatus) => void;
}

interface MessageStore {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
}

interface RequirementStore {
  requirements: Requirement[];
  setRequirements: (requirements: Requirement[]) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    })),
}));

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgent: (agent) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
    })),
}));

export const useMessageStore = create<MessageStore>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));

export const useRequirementStore = create<RequirementStore>((set) => ({
  requirements: [],
  setRequirements: (requirements) => set({ requirements }),
}));
