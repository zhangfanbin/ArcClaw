import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task } from '../../types/task.js';
import type { AgentMessage } from '../../types/message.js';
import type { AppConfig } from '../../config.js';
import type { AgentRoleConfig } from '../../types/agent-config.js';
import { TaskStore } from '../../task-board/task-store.js';
import { MessageBus } from '../../messaging/message-bus.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { BaseAgent } from '../base-agent.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('pd-agent');

export class PdAgent extends BaseAgent {
  private roleConfig?: AgentRoleConfig;

  constructor(
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry,
    roleConfig?: AgentRoleConfig,
  ) {
    super('pd', config, taskStore, messageBus, toolRegistry);
    this.roleConfig = roleConfig;
  }

  getModelTier(): 'powerful' | 'fast' {
    return this.roleConfig?.modelTier ?? 'fast';
  }

  async getSystemPrompt(): Promise<string> {
    // 1. Try .arcclaw/agents/pd/{systemPromptSource} (user override)
    if (this.roleConfig?.systemPromptSource) {
      const arcclawPromptPath = path.join(
        this.config.paths.arcclawHome, 'agents', 'pd', this.roleConfig.systemPromptSource,
      );
      try {
        return await fs.readFile(arcclawPromptPath, 'utf-8');
      } catch { /* fall through */ }
    }

    // 2. Try shipped prompts/ directory
    const promptPath = path.join(this.config.paths.promptsDir, 'pd-agent.system.md');
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      // 3. Inline fallback
      return `You are the Product Manager agent. You specialize in:
1. Analyzing user requirements
2. Creating Product Requirement Documents (PRDs)
3. Writing user stories with acceptance criteria
4. Answering questions about requirements`;
    }
  }

  async onTaskReceived(task: Task): Promise<void> {
    logger.info({ taskId: task.id, title: task.title }, 'PD Agent processing task');

    // Generate PRD based on the task
    const prompt = `
First, use the code_search and file_reader tools to understand what the existing project already has:
- What features and pages currently exist?
- What is the project's purpose and domain?
- What existing components relate to this new feature?

Then create a Product Requirements Document (PRD) for:

**Task**: ${task.title}
**Description**: ${task.description}

Generate a comprehensive PRD including:
1. Existing Context - what the project currently has that relates to this feature
2. Overview and goals - what new capability is being added
3. User stories with acceptance criteria
4. Scope (in/out)
5. Integration Points - how this connects to existing functionality
6. Dependencies and constraints

Do NOT describe features that already exist. Focus on what's NEW and how it integrates.
`;

    const response = await this.think(prompt);

    // Save PRD artifact under .arcclaw/data/artifacts
    const arcclawHome = this.config.paths.arcclawHome;
    const prdPath = `${arcclawHome}/data/artifacts/pd/PRD_${task.id}.md`;
    const fileWriter = this.toolRegistry.get('file_writer');
    if (fileWriter) {
      await fileWriter.execute({
        file_path: prdPath,
        content: response,
        overwrite: true,
      });

      await this.taskStore.addArtifact(task.id, prdPath);
    }

    // Notify team leader that task is complete
    await this.updateTaskStatus(task.id, 'completed', 'PRD generated');
    await this.sendMessage(
      'team_leader',
      'task_completed',
      `Completed: ${task.title}`,
      `PRD has been generated and saved to ${prdPath}`,
      { task_id: task.id, requirement_id: task.requirement_id, artifact: prdPath }
    );

    // Notify frontend and backend that PRD is ready
    await this.sendMessage(
      'all',
      'progress_update',
      'PRD Ready',
      `PRD for "${task.title}" has been generated. Available at: ${prdPath}`,
      { task_id: task.id, artifact: prdPath }
    );
  }

  async onMessageReceived(message: AgentMessage): Promise<void> {
    logger.info(
      { from: message.from, type: message.type, subject: message.subject },
      'PD Agent received message'
    );

    if (message.type === 'question') {
      // Answer questions about requirements
      const response = await this.think(
        `You have received a question about requirements:\n\nFrom: ${message.from}\nSubject: ${message.subject}\n\n${message.body}\n\nPlease provide a clear answer.`
      );

      await this.sendMessage(
        message.from,
        'answer',
        `Re: ${message.subject}`,
        response,
        message.metadata
      );
    }
  }
}
