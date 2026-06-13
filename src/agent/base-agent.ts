import { generateText, type CoreMessage, type ToolSet } from 'ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentId, AgentState, AgentStatus } from '../types/agent.js';
import type { Task, TaskAssigneeType } from '../types/task.js';
import type { AgentMessage } from '../types/message.js';
import type { AppConfig } from '../config.js';
import type { Tool } from '../types/tool.js';
import type { LLMLogEntry } from '../types/llm.js';
import { TaskStore } from '../task-board/task-store.js';
import { MessageBus } from '../messaging/message-bus.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { ContextWindow } from './context-window.js';
import { createModel, callLLMWithRetry } from '../llm/provider-factory.js';
import { getLLMLogger } from '../llm/llm-logger.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('base-agent');

export abstract class BaseAgent {
  readonly id: AgentId;
  protected config: AppConfig;
  protected model: any = null;
  protected context: ContextWindow;
  protected toolRegistry: ToolRegistry;
  protected taskStore: TaskStore;
  protected messageBus: MessageBus;
  protected workspaceDir: string;

  protected status: AgentStatus;
  protected running: boolean = false;
  protected currentRequirementId: string | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor(
    id: AgentId,
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry
  ) {
    this.id = id;
    this.config = config;
    this.taskStore = taskStore;
    this.messageBus = messageBus;
    this.toolRegistry = toolRegistry;
    this.workspaceDir = config.paths.workspaceDir;

    this.context = new ContextWindow({
      tokenBudget: config.agents.contextTokenBudget,
      reservedForResponse: 2000,
    });

    this.status = {
      id,
      state: 'idle',
      current_task_id: null,
      context_usage: 0,
      last_activity: new Date().toISOString(),
      error: null,
    };
  }

  /**
   * Get the model tier for this agent.
   * 'powerful' uses config.llm.model, 'fast' uses config.llm.modelFast.
   */
  abstract getModelTier(): 'powerful' | 'fast';

  /**
   * Ensure the LLM model is created (lazy initialization).
   */
  protected async ensureModel(): Promise<void> {
    if (!this.model) {
      const tier = this.getModelTier();
      const llmConfig = {
        ...this.config.llm,
        model: tier === 'powerful' ? this.config.llm.model : this.config.llm.modelFast,
      };
      logger.info({ agentId: this.id, tier, model: llmConfig.model }, 'Creating model for agent');
      this.model = await createModel(llmConfig);
    }
  }

  /**
   * Get the system prompt for this agent.
   */
  abstract getSystemPrompt(): Promise<string>;

  /**
   * Handle a task assigned to this agent.
   */
  abstract onTaskReceived(task: Task): Promise<void>;

  /**
   * Handle a message received from another agent.
   */
  abstract onMessageReceived(message: AgentMessage): Promise<void>;

  /**
   * Initialize the agent (load model, set up subscriptions).
   */
  async init(): Promise<void> {
    // Create workspace directory
    await fs.mkdir(this.workspaceDir, { recursive: true });

    // Defer model creation to first think() call - allows startup without API keys
    // Set up system prompt
    const systemPrompt = await this.getSystemPrompt();
    this.context.addMessage({ role: 'system', content: systemPrompt });

    // Subscribe to task assignments
    const taskCreatedHandler = async (task: Task) => {
      if (task.assignee === this.id && this.running) {
        await this.handleTask(task);
      }
    };
    this.taskStore.getWatcher().onTaskCreated(taskCreatedHandler);
    this.unsubscribers.push(() => this.taskStore.getWatcher().off('task_created', taskCreatedHandler));

    // Subscribe to task status changes (for monitoring)
    const statusChangedHandler = async (task: Task, _oldStatus: any, newStatus: any) => {
      if (task.assignee === this.id && newStatus === 'in_progress') {
        if (this.status.state === 'idle') {
          await this.handleTask(task);
        }
      }
    };
    this.taskStore.getWatcher().onTaskStatusChanged(statusChangedHandler);
    this.unsubscribers.push(() => this.taskStore.getWatcher().off('task_status_changed', statusChangedHandler));

    // Subscribe to messages
    const unsubMessages = this.messageBus.onMessage(this.id, async (msg) => {
      if (this.running) {
        await this.handleMessage(msg);
      }
    });
    this.unsubscribers.push(unsubMessages);

    // Also subscribe to broadcasts
    const unsubBroadcast = this.messageBus.onBroadcast(async (msg) => {
      if (this.running && msg.from !== this.id) {
        await this.handleMessage(msg);
      }
    });
    this.unsubscribers.push(unsubBroadcast);

    logger.info({ agentId: this.id }, 'Agent initialized');
  }

  /**
   * Start the agent's event loop.
   */
  async start(): Promise<void> {
    this.running = true;
    this.status.state = 'idle';
    logger.info({ agentId: this.id }, 'Agent started');

    // Check for any pending tasks assigned to us
    const pendingTasks = await this.taskStore.list({
      status: 'pending',
      assignee: this.id as TaskAssigneeType,
    });

    for (const task of pendingTasks) {
      if (this.running) {
        await this.handleTask(task);
      }
    }
  }

  /**
   * Stop the agent.
   */
  async stop(): Promise<void> {
    this.running = false;
    this.status.state = 'idle';

    // Clean up subscriptions
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    logger.info({ agentId: this.id }, 'Agent stopped');
  }

  /**
   * Get current agent status.
   */
  getStatus(): AgentStatus {
    return { ...this.status };
  }

  /**
   * Send a message to another agent.
   */
  protected async sendMessage(
    to: AgentId | 'all',
    type: 'task_assigned' | 'question' | 'answer' | 'review_request' | 'review_response' | 'progress_update' | 'task_completed' | 'broadcast',
    subject: string,
    body: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.messageBus.send({
      from: this.id,
      to,
      type,
      subject,
      body,
      metadata,
    });
  }

  /**
   * Use the LLM to think/reason, with optional tool calls.
   */
  protected async think(
    userPrompt: string,
    maxSteps?: number
  ): Promise<string> {
    this.context.addMessage({ role: 'user', content: userPrompt });
    this.context.trimToBudget();

    this.status.state = 'thinking';
    this.status.last_activity = new Date().toISOString();

    const startTime = Date.now();
    const llmLogger = getLLMLogger();

    // Capture input messages for logging (trim long content)
    const inputMessages = this.context.getMessages().map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content.length > 2000
          ? m.content.slice(0, 2000) + '...[truncated]'
          : m.content
        : JSON.stringify(m.content).slice(0, 2000),
    }));

    try {
      // Ensure model is initialized
      await this.ensureModel();

      // Get tools available to this agent
      const agentTools = this.toolRegistry.getForAgent(this.id);
      const toolSet = this.buildToolSet(agentTools);

      const messages: CoreMessage[] = this.context.getMessages().map((m) => ({
        role: m.role as any,
        content: m.content,
      }));

      const tier = this.getModelTier();
      const modelName = tier === 'powerful' ? this.config.llm.model : this.config.llm.modelFast;

      const result = await callLLMWithRetry(this.model, async () => {
        return generateText({
          model: this.model,
          messages,
          ...(Object.keys(toolSet).length > 0 ? { tools: toolSet } : {}),
          maxSteps: maxSteps ?? this.config.agents.maxSteps,
          maxTokens: this.config.llm.maxTokens,
          temperature: this.config.llm.temperature,
        });
      });

      const responseText = result.text || '';
      const durationMs = Date.now() - startTime;

      this.context.addMessage({ role: 'assistant', content: responseText });
      this.status.context_usage = this.context.getTokenCount();
      this.status.state = 'idle';
      this.status.last_activity = new Date().toISOString();

      // Extract tool calls from result
      const toolCalls = (result.toolCalls || []).map((tc: any) => ({
        name: tc.toolName || tc.name || 'unknown',
        arguments: tc.args || tc.arguments || {},
      }));

      // Log the LLM call
      if (llmLogger) {
        const usage = result.usage || {};
        llmLogger.log({
          duration_ms: durationMs,
          agent_id: this.id,
          requirement_id: this.currentRequirementId,
          task_id: this.status.current_task_id,
          model: modelName,
          provider: this.config.llm.provider,
          model_tier: tier,
          input_messages: inputMessages,
          output_text: responseText.length > 3000
            ? responseText.slice(0, 3000) + '...[truncated]'
            : responseText,
          tool_calls: toolCalls,
          input_tokens: usage.promptTokens || 0,
          output_tokens: usage.completionTokens || 0,
          total_tokens: usage.totalTokens || 0,
          finish_reason: result.finishReason || 'unknown',
          max_tokens: this.config.llm.maxTokens,
          temperature: this.config.llm.temperature,
          error: null,
        }).catch(() => {
          // Log failure should not break the agent
        });
      }

      return responseText;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.status.state = 'error';
      this.status.error = error.message;
      this.status.last_activity = new Date().toISOString();

      // Log the failed LLM call
      if (llmLogger) {
        const tier = this.getModelTier();
        const modelName = tier === 'powerful' ? this.config.llm.model : this.config.llm.modelFast;
        llmLogger.log({
          duration_ms: durationMs,
          agent_id: this.id,
          requirement_id: this.currentRequirementId,
          task_id: this.status.current_task_id,
          model: modelName,
          provider: this.config.llm.provider,
          model_tier: tier,
          input_messages: inputMessages,
          output_text: '',
          tool_calls: [],
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          finish_reason: 'error',
          max_tokens: this.config.llm.maxTokens,
          temperature: this.config.llm.temperature,
          error: error.message,
        }).catch(() => {});
      }

      logger.error({ agentId: this.id, error: error.message }, 'LLM call failed');
      throw error;
    }
  }

  /**
   * Update task status.
   */
  protected async updateTaskStatus(
    taskId: string,
    status: 'in_progress' | 'completed' | 'blocked',
    reason: string
  ): Promise<void> {
    await this.taskStore.transitionStatus(taskId, status, reason, this.id);
  }

  /**
   * Handle an incoming task.
   */
  private async handleTask(task: Task): Promise<void> {
    this.status.current_task_id = task.id;
    this.currentRequirementId = task.requirement_id;
    this.status.state = 'thinking';

    try {
      await this.updateTaskStatus(task.id, 'in_progress', 'Starting work on task');
      await this.onTaskReceived(task);
    } catch (error: any) {
      this.status.state = 'error';
      this.status.error = error.message;
      logger.error({ agentId: this.id, taskId: task.id, error: error.message }, 'Task handling failed');
    } finally {
      this.status.current_task_id = null;
      if (this.status.state !== 'error') {
        this.status.state = 'idle';
      }
    }
  }

  /**
   * Handle an incoming message.
   */
  private async handleMessage(message: AgentMessage): Promise<void> {
    try {
      await this.messageBus.markAsRead(message.id);
      await this.onMessageReceived(message);
    } catch (error: any) {
      logger.error({ agentId: this.id, messageId: message.id, error: error.message }, 'Message handling failed');
    }
  }

  /**
   * Build a Vercel AI SDK compatible tool set from our Tool registry.
   */
  private buildToolSet(tools: Tool[]): ToolSet {
    const toolSet: ToolSet = {};

    for (const tool of tools) {
      toolSet[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: async (params: any) => {
          this.status.state = 'executing_tool';
          this.status.last_activity = new Date().toISOString();

          const result = await tool.execute(params);

          this.status.state = 'thinking';
          return result;
        },
      };
    }

    return toolSet;
  }
}
