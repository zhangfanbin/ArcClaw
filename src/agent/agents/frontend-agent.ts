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

    // Step 1: Explore project and generate TRD
    const trdPrompt = `
First, use the code_search and file_reader tools to explore the existing project:
- What frontend framework is used (React, Vue, Angular, Svelte, etc.)?
- What UI library and styling approach (Tailwind, Material UI, shadcn, CSS modules, etc.)?
- What is the directory structure for components, pages, and assets?
- What existing component patterns, hooks, and state management exist?
- What routing and navigation patterns are used?

Then create a Technical Requirements Document (TRD) for the frontend implementation:

**Task**: ${task.title}
**Description**: ${task.description}

The TRD MUST be based on the ACTUAL project tech stack you discovered, NOT assumptions.
Include: component architecture, API contracts, state management, and integration points with existing components.

Output the complete TRD in your response.
`;

    const trdResponse = await this.think(trdPrompt);

    // Save TRD under .arcclaw/data/artifacts
    const arcclawHome = this.config.paths.arcclawHome;
    const trdPath = `${arcclawHome}/data/artifacts/frontend/TRD_${task.id}.md`;
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

IMPORTANT:
- Use the SAME framework, UI library, and patterns as the existing project
- Place files in the CORRECT existing directories (do NOT create new top-level dirs)
- Reuse existing components, hooks, and utilities
- Follow the project's naming conventions, styling approach, and coding style
- Use file_reader to read existing related components before writing new ones
- Output code blocks with correct file paths (e.g. // File: src/components/LoginForm.tsx)
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
          file_path: filePath,
          content: code,
          overwrite: true,
        });
        await this.taskStore.addArtifact(taskId, filePath);
        fileCount++;
      }
    }

    // If no file blocks found, save the entire response as a single file
    if (fileCount === 0 && response.length > 100) {
      const arcclawHome = this.config.paths.arcclawHome;
      const artifactPath = `${arcclawHome}/data/artifacts/frontend/${taskId}/implementation.md`;
      await fileWriter.execute({
        file_path: artifactPath,
        content: response,
        overwrite: true,
      });
      await this.taskStore.addArtifact(taskId, artifactPath);
    }
  }
}
