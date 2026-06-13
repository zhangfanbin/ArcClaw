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

const logger = createLogger('qa-agent');

export class QaAgent extends BaseAgent {
  private roleConfig?: AgentRoleConfig;

  constructor(
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry,
    roleConfig?: AgentRoleConfig,
  ) {
    super('qa', config, taskStore, messageBus, toolRegistry);
    this.roleConfig = roleConfig;
  }

  getModelTier(): 'powerful' | 'fast' {
    return this.roleConfig?.modelTier ?? 'fast';
  }

  async getSystemPrompt(): Promise<string> {
    // 1. Try .arcclaw/agents/qa/{systemPromptSource}
    if (this.roleConfig?.systemPromptSource) {
      const arcclawPromptPath = path.join(
        this.config.paths.arcclawHome, 'agents', 'qa', this.roleConfig.systemPromptSource,
      );
      try {
        return await fs.readFile(arcclawPromptPath, 'utf-8');
      } catch { /* fall through */ }
    }

    // 2. Try shipped prompts/ directory
    const promptPath = path.join(this.config.paths.promptsDir, 'qa-agent.system.md');
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      // 3. Inline fallback
      return `You are the QA Engineer agent. You specialize in:
1. Creating test plans from PRDs and TRDs
2. Writing test cases with expected outcomes
3. Performing automated testing
4. Providing quality assessments (PASS/FAIL/NEEDS_WORK)`;
    }
  }

  async onTaskReceived(task: Task): Promise<void> {
    logger.info({ taskId: task.id, title: task.title }, 'QA Agent processing task');

    // Generate test plan
    const prompt = `
Create a comprehensive test plan for the following:

**Task**: ${task.title}
**Description**: ${task.description}

Generate:
1. Test strategy overview
2. Specific test cases (ID, description, steps, expected result, priority)
3. Edge cases to consider
4. Acceptance criteria mapping

Output the complete test plan in your response (do NOT call any tools).
`;

    const response = await this.think(prompt);

    // Save test plan under .arcclaw/data/artifacts/qa/
    const arcclawHome = this.config.paths.arcclawHome;
    const artifactsDir = path.join(arcclawHome, 'data', 'artifacts', 'qa');
    await fs.mkdir(artifactsDir, { recursive: true });
    const testFileName = `TEST_${task.id}.md`;
    const testPlanPath = path.join(artifactsDir, testFileName);
    const relativePath = path.relative(this.workspaceDir, testPlanPath);
    const fileWriter = this.toolRegistry.get('file_writer');
    if (fileWriter) {
      await fileWriter.execute({
        file_path: relativePath,
        content: response,
        overwrite: true,
      });
      await this.taskStore.addArtifact(task.id, relativePath);
    }

    // Mark task as complete
    await this.updateTaskStatus(task.id, 'completed', 'Test plan generated');

    // Notify team leader
    await this.sendMessage(
      'team_leader',
      'task_completed',
      `Completed: ${task.title}`,
      `Test plan generated and saved to ${testPlanPath}`,
      { task_id: task.id, requirement_id: task.requirement_id, artifact: testPlanPath }
    );
  }

  async onMessageReceived(message: AgentMessage): Promise<void> {
    logger.info(
      { from: message.from, type: message.type, subject: message.subject },
      'QA Agent received message'
    );

    switch (message.type) {
      case 'review_request':
        await this.handleReviewRequest(message);
        break;
      case 'question':
        await this.handleQuestion(message);
        break;
    }
  }

  /**
   * Handle a review request from Frontend or Backend agent.
   */
  private async handleReviewRequest(message: AgentMessage): Promise<void> {
    const taskId = message.metadata.task_id as string;
    const reviewType = message.metadata.type as string;

    logger.info({ taskId, reviewType }, 'Performing code review');

    const prompt = `
You have been asked to review ${reviewType || ''} implementation.

**Subject**: ${message.subject}
**Details**: ${message.body}

Perform a thorough quality assessment:
1. Code quality review
2. Test coverage analysis
3. Best practices compliance
4. Potential issues or bugs

Provide your assessment as:
- **Status**: PASS / FAIL / NEEDS_WORK
- **Summary**: Overall assessment
- **Details**: Specific findings
- **Issues**: List of issues (if any)
- **Recommendations**: Suggested improvements
`;

    const response = await this.think(prompt);

    // Parse the status from the response
    let status: 'PASS' | 'FAIL' | 'NEEDS_WORK' = 'NEEDS_WORK';
    if (/PASS/i.test(response) && !/FAIL/i.test(response)) {
      status = 'PASS';
    } else if (/FAIL/i.test(response)) {
      status = 'FAIL';
    }

    // Send review response
    await this.sendMessage(
      message.from,
      'review_response',
      `Review: ${message.subject}`,
      response,
      {
        ...message.metadata,
        status,
        reviewer: 'qa',
      }
    );

    // Also notify team leader
    await this.sendMessage(
      'team_leader',
      'review_response',
      `Review Complete: ${message.subject}`,
      `Review status: ${status}\n\n${response}`,
      { ...message.metadata, status }
    );
  }

  private async handleQuestion(message: AgentMessage): Promise<void> {
    const response = await this.think(
      `You received a question about testing/quality:\n\nFrom: ${message.from}\n${message.body}\n\nProvide a helpful answer.`
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
