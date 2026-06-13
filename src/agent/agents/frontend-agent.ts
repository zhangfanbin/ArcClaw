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

const logger = createLogger('frontend-agent');

export class FrontendAgent extends BaseAgent {
  private roleConfig?: AgentRoleConfig;

  constructor(
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry,
    roleConfig?: AgentRoleConfig,
  ) {
    super('frontend', config, taskStore, messageBus, toolRegistry);
    this.roleConfig = roleConfig;
  }

  getModelTier(): 'powerful' | 'fast' {
    return this.roleConfig?.modelTier ?? 'fast';
  }

  async getSystemPrompt(): Promise<string> {
    // 1. Try .arcclaw/agents/frontend/{systemPromptSource}
    if (this.roleConfig?.systemPromptSource) {
      const arcclawPromptPath = path.join(
        this.config.paths.arcclawHome, 'agents', 'frontend', this.roleConfig.systemPromptSource,
      );
      try {
        return await fs.readFile(arcclawPromptPath, 'utf-8');
      } catch { /* fall through */ }
    }

    // 2. Try shipped prompts/ directory
    const promptPath = path.join(this.config.paths.promptsDir, 'frontend-agent.system.md');
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      // 3. Inline fallback
      return `You are the Frontend Developer agent. You specialize in:
1. Creating frontend Technical Requirement Documents (TRDs)
2. Building React/TypeScript UI components
3. Implementing responsive user interfaces
4. Integrating with backend APIs`;
    }
  }

  async onTaskReceived(task: Task): Promise<void> {
    logger.info({ taskId: task.id, title: task.title }, 'Frontend Agent processing task');

    // Step 1: Generate TRD
    const trdPrompt = `
Create a Technical Requirements Document (TRD) for the frontend implementation:

**Task**: ${task.title}
**Description**: ${task.description}

Generate a TRD including:
1. Component architecture
2. API contracts (expected endpoints and response shapes)
3. State management decisions
4. Key implementation considerations

Output the complete TRD document in your response (do NOT call any tools).
`;

    const trdResponse = await this.think(trdPrompt);

    // Save TRD
    const trdPath = `TRD_frontend_${task.id}.md`;
    const fileWriter = this.toolRegistry.get('file_writer');
    if (fileWriter) {
      await fileWriter.execute({
        file_path: trdPath,
        content: trdResponse,
        overwrite: true,
      });
      await this.taskStore.addArtifact(task.id, trdPath);
    }

    // Step 2: Implement the code
    const codePrompt = `
Based on the task and TRD, implement the frontend code:

**Task**: ${task.title}
**Description**: ${task.description}
**TRD**: ${trdResponse}

Create the necessary React/TypeScript components and files.
Write clean, well-typed, production-ready code.
`;

    const codeResponse = await this.think(codePrompt);

    // Extract and save code files from the response
    await this.extractAndSaveCode(codeResponse, task.id);

    // Mark task as complete
    await this.updateTaskStatus(task.id, 'completed', 'Frontend implementation complete');

    // Request QA review
    await this.sendMessage(
      'qa',
      'review_request',
      `Review Request: ${task.title}`,
      `Frontend implementation for "${task.title}" is complete. Please review the code and test.`,
      { task_id: task.id, requirement_id: task.requirement_id, type: 'frontend' }
    );

    // Notify team leader
    await this.sendMessage(
      'team_leader',
      'task_completed',
      `Completed: ${task.title}`,
      `Frontend implementation complete with TRD and code.`,
      { task_id: task.id, requirement_id: task.requirement_id }
    );
  }

  async onMessageReceived(message: AgentMessage): Promise<void> {
    logger.info(
      { from: message.from, type: message.type, subject: message.subject },
      'Frontend Agent received message'
    );

    switch (message.type) {
      case 'question':
        await this.handleQuestion(message);
        break;
      case 'review_response':
        await this.handleReviewResponse(message);
        break;
      case 'progress_update':
        // Check if it's a PRD update we need
        if (message.metadata.artifact && String(message.metadata.artifact).startsWith('PRD_')) {
          logger.info('Received PRD update notification');
        }
        break;
    }
  }

  private async handleQuestion(message: AgentMessage): Promise<void> {
    const response = await this.think(
      `You received a question about the frontend implementation:\n\nFrom: ${message.from}\n${message.body}\n\nProvide a helpful answer.`
    );

    await this.sendMessage(
      message.from,
      'answer',
      `Re: ${message.subject}`,
      response,
      message.metadata
    );
  }

  private async handleReviewResponse(message: AgentMessage): Promise<void> {
    if (message.metadata.status === 'NEEDS_WORK') {
      logger.info('QA requested fixes, addressing them');
      const response = await this.think(
        `QA has requested fixes for your frontend code:\n\n${message.body}\n\nPlease address the issues and provide the fixes.`
      );
      await this.sendMessage(
        'qa',
        'progress_update',
        'Fixes Applied',
        response,
        message.metadata
      );
    }
  }

  /**
   * Extract code blocks from LLM response and save them to files.
   */
  private async extractAndSaveCode(response: string, taskId: string): Promise<void> {
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
        await fileWriter.execute({
          file_path: `frontend/${taskId}/${filePath}`,
          content: code,
          overwrite: true,
        });
        await this.taskStore.addArtifact(taskId, `frontend/${taskId}/${filePath}`);
        fileCount++;
      }
    }

    // If no file blocks found, save the entire response as a single file
    if (fileCount === 0 && response.length > 100) {
      await fileWriter.execute({
        file_path: `frontend/${taskId}/implementation.tsx`,
        content: response,
        overwrite: true,
      });
      await this.taskStore.addArtifact(taskId, `frontend/${taskId}/implementation.tsx`);
    }
  }
}
