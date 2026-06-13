import type { Task } from '../../types/task.js';
import type { AgentMessage } from '../../types/message.js';
import type { AppConfig } from '../../config.js';
import type { AgentRoleConfig } from '../../types/agent-config.js';
import { TaskStore } from '../../task-board/task-store.js';
import { MessageBus } from '../../messaging/message-bus.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { BaseAgent } from '../base-agent.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('configurable-agent');

/**
 * A generic agent whose behaviour is entirely driven by its AgentRoleConfig
 * and system prompt. Used for user-defined custom agent roles that live
 * under `.arcclaw/agents/{role}/`.
 */
export class ConfigurableAgent extends BaseAgent {
  private roleConfig: AgentRoleConfig;
  private systemPromptText: string;

  constructor(
    roleConfig: AgentRoleConfig,
    systemPrompt: string,
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry,
  ) {
    super(roleConfig.id, config, taskStore, messageBus, toolRegistry);
    this.roleConfig = roleConfig;
    this.systemPromptText = systemPrompt;
  }

  getModelTier(): 'powerful' | 'fast' {
    return this.roleConfig.modelTier ?? 'fast';
  }

  async getSystemPrompt(): Promise<string> {
    return this.systemPromptText;
  }

  // ---------------------------------------------------------------------------
  // Task handling — generic implementation driven by LLM + system prompt
  // ---------------------------------------------------------------------------

  async onTaskReceived(task: Task): Promise<void> {
    logger.info({ taskId: task.id, title: task.title, agentId: this.id }, 'ConfigurableAgent processing task');

    const prompt = `
You have been assigned the following task:

**Task**: ${task.title}
**Description**: ${task.description}

Based on your role and expertise, complete this task to the best of your ability.
If your work produces any artifacts or deliverables, describe them clearly.
`;

    const response = await this.think(prompt);

    // Attempt to extract and save code/text artifacts from the response
    await this.extractAndSaveArtifacts(response, task.id);

    // Mark task as complete
    await this.updateTaskStatus(task.id, 'completed', `Task completed by ${this.roleConfig.displayName ?? this.id}`);

    // Notify team leader
    await this.sendMessage(
      'team_leader',
      'task_completed',
      `Completed: ${task.title}`,
      `${this.roleConfig.displayName ?? this.id} has completed the task.`,
      { task_id: task.id, requirement_id: task.requirement_id }
    );
  }

  async onMessageReceived(message: AgentMessage): Promise<void> {
    logger.info(
      { from: message.from, type: message.type, subject: message.subject, agentId: this.id },
      'ConfigurableAgent received message',
    );

    // Generic response — let the LLM decide how to reply based on system prompt
    const response = await this.think(
      `You received a message:\n\nFrom: ${message.from}\nType: ${message.type}\nSubject: ${message.subject}\n\n${message.body}\n\nPlease respond appropriately based on your role.`,
    );

    await this.sendMessage(
      message.from,
      'answer',
      `Re: ${message.subject}`,
      response,
      message.metadata,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract code blocks or long text from the LLM response and save as artifacts.
   */
  private async extractAndSaveArtifacts(response: string, taskId: string): Promise<void> {
    const fileWriter = this.toolRegistry.get('file_writer');
    if (!fileWriter) return;

    // Match code blocks with file path hints
    const codeBlockRegex = /```(?:\w+)?\s*(?:\/\/|#|\/\*\s*File:?\s*)([^\n*]+)[\s\S]*?\n([\s\S]*?)```/g;
    let match;
    let fileCount = 0;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const filePath = match[1].trim();
      const code = match[2].trim();

      if (filePath && code) {
        // Write directly to the project workspace using the LLM-specified path
        await fileWriter.execute({
          file_path: filePath,
          content: code,
          overwrite: true,
        });
        await this.taskStore.addArtifact(taskId, filePath);
        fileCount++;
      }
    }

    // If no file blocks found but response is substantial, save under .arcclaw/data/artifacts
    if (fileCount === 0 && response.length > 100) {
      const arcclawHome = this.config.paths.arcclawHome;
      const artifactPath = `${arcclawHome}/data/artifacts/${this.id}/${taskId}/output.md`;
      await fileWriter.execute({
        file_path: artifactPath,
        content: response,
        overwrite: true,
      });
      await this.taskStore.addArtifact(taskId, artifactPath);
    }
  }
}
