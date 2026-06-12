import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task } from '../../types/task.js';
import type { AgentMessage } from '../../types/message.js';
import type { AppConfig } from '../../config.js';
import { TaskStore } from '../../task-board/task-store.js';
import { MessageBus } from '../../messaging/message-bus.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { BaseAgent } from '../base-agent.js';
import { createLogger } from '../../utils/logger.js';
import { generateId } from '../../utils/id-generator.js';
import { getReadyTasks, topologicalSort } from '../../task-board/dependency-resolver.js';

const logger = createLogger('team-leader');

export class TeamLeaderAgent extends BaseAgent {
  constructor(
    config: AppConfig,
    taskStore: TaskStore,
    messageBus: MessageBus,
    toolRegistry: ToolRegistry
  ) {
    super('team_leader', config, taskStore, messageBus, toolRegistry);
  }

  getModelTier(): 'powerful' {
    return 'powerful';
  }

  async getSystemPrompt(): Promise<string> {
    const promptPath = path.join(this.config.paths.promptsDir, 'team-leader.system.md');
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      return `You are the Team Leader of a software delivery team. You orchestrate the development process.
You do NOT write code directly. Instead, you:
1. Analyze requirements and break them into tasks
2. Assign tasks to team members (pd, frontend, backend, qa)
3. Monitor progress and ensure quality
4. Coordinate between team members`;
    }
  }

  async onTaskReceived(task: Task): Promise<void> {
    // Team Leader handles "requirement" type tasks
    logger.info({ taskId: task.id, title: task.title }, 'Team Leader processing requirement');

    await this.analyzeAndDecompose(task);
  }

  async onMessageReceived(message: AgentMessage): Promise<void> {
    logger.info(
      { from: message.from, type: message.type, subject: message.subject },
      'Team Leader received message'
    );

    switch (message.type) {
      case 'task_completed':
        await this.handleTaskCompleted(message);
        break;
      case 'question':
        await this.handleQuestion(message);
        break;
      case 'review_response':
        await this.handleReviewResponse(message);
        break;
      default:
        logger.info({ type: message.type }, 'Unhandled message type');
    }
  }

  /**
   * Analyze a requirement and decompose it into tasks.
   */
  private async analyzeAndDecompose(requirement: Task): Promise<void> {
    const prompt = `
Analyze the following requirement and break it down into specific tasks.

**Requirement**: ${requirement.title}
**Description**: ${requirement.description}

Create a task breakdown with:
1. PD Agent tasks (requirement analysis, PRD)
2. Frontend Agent tasks (UI development)
3. Backend Agent tasks (API development)
4. QA Agent tasks (testing)

For each task, provide:
- Title
- Description
- Assignee (pd, frontend, backend, qa)
- Priority (critical, high, medium, low)
- Dependencies (which tasks must complete first)

Format your response as a JSON array of tasks.
`;

    const response = await this.think(prompt);

    // Parse the response to extract tasks
    try {
      const tasks = this.parseTaskResponse(response, requirement.requirement_id);

      // Create tasks in the task board
      for (const taskInput of tasks) {
        await this.taskStore.create(taskInput);
      }

      logger.info(
        { requirementId: requirement.requirement_id, taskCount: tasks.length },
        'Requirement decomposed into tasks'
      );

      // Broadcast decomposition complete
      await this.sendMessage(
        'all',
        'broadcast',
        'Tasks Decomposed',
        `Requirement "${requirement.title}" has been broken into ${tasks.length} tasks.`,
        { requirement_id: requirement.requirement_id }
      );
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to parse task decomposition');
    }
  }

  /**
   * Parse LLM response into task inputs.
   */
  private parseTaskResponse(response: string, requirementId: string): Array<{
    title: string;
    description: string;
    assignee: 'pd' | 'frontend' | 'backend' | 'qa';
    priority: 'critical' | 'high' | 'medium' | 'low';
    requirement_id: string;
  }> {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((t: any) => ({
          title: t.title || 'Untitled Task',
          description: t.description || '',
          assignee: t.assignee || 'pd',
          priority: t.priority || 'medium',
          requirement_id: requirementId,
        }));
      } catch {
        // Fall through to manual parsing
      }
    }

    // Fallback: create default task set
    return [
      {
        title: 'Product Requirements Analysis',
        description: 'Analyze and document the product requirements',
        assignee: 'pd',
        priority: 'high',
        requirement_id: requirementId,
      },
      {
        title: 'Frontend Implementation',
        description: 'Implement the frontend components',
        assignee: 'frontend',
        priority: 'medium',
        requirement_id: requirementId,
      },
      {
        title: 'Backend Implementation',
        description: 'Implement the backend API and services',
        assignee: 'backend',
        priority: 'medium',
        requirement_id: requirementId,
      },
      {
        title: 'Quality Assurance',
        description: 'Test and verify the implementation',
        assignee: 'qa',
        priority: 'high',
        requirement_id: requirementId,
      },
    ];
  }

  /**
   * Handle task completed notification.
   */
  private async handleTaskCompleted(message: AgentMessage): Promise<void> {
    const taskId = message.metadata.task_id as string;
    const requirementId = message.metadata.requirement_id as string;

    if (!requirementId) return;

    // Check if all tasks for this requirement are complete
    const allTasks = await this.taskStore.list({ requirement_id: requirementId });
    const allComplete = allTasks.every(
      (t) => t.status === 'completed' || t.status === 'cancelled'
    );

    if (allComplete) {
      logger.info({ requirementId }, 'All tasks for requirement completed');

      // Request QA review
      await this.sendMessage(
        'qa',
        'review_request',
        'Final Quality Review',
        `All tasks for requirement ${requirementId} are complete. Please perform a final quality review.`,
        { requirement_id: requirementId }
      );
    } else {
      // Check if there are ready tasks that haven't been started
      const readyTasks = getReadyTasks(allTasks);
      for (const task of readyTasks) {
        if (task.assignee && task.status === 'pending') {
          await this.sendMessage(
            task.assignee,
            'task_assigned',
            `Task Ready: ${task.title}`,
            task.description,
            { task_id: task.id, requirement_id: requirementId }
          );
        }
      }
    }
  }

  /**
   * Handle question from a teammate.
   */
  private async handleQuestion(message: AgentMessage): Promise<void> {
    const response = await this.think(
      `A team member has asked a question:\n\nFrom: ${message.from}\nSubject: ${message.subject}\n\n${message.body}\n\nPlease provide guidance.`
    );

    await this.sendMessage(
      message.from,
      'answer',
      `Re: ${message.subject}`,
      response,
      message.metadata
    );
  }

  /**
   * Handle QA review response.
   */
  private async handleReviewResponse(message: AgentMessage): Promise<void> {
    const requirementId = message.metadata.requirement_id as string;
    const passed = message.metadata.status === 'PASS';

    if (passed) {
      logger.info({ requirementId }, 'QA review passed - requirement complete');
      await this.sendMessage(
        'all',
        'broadcast',
        'Requirement Complete',
        `Requirement ${requirementId} has passed QA review and is complete.`,
        { requirement_id: requirementId }
      );
    } else {
      logger.info({ requirementId }, 'QA review failed - needs fixes');
      // Request fixes from relevant agents
      await this.sendMessage(
        'all',
        'broadcast',
        'QA Review Failed',
        `Requirement ${requirementId} needs fixes. Details: ${message.body}`,
        { requirement_id: requirementId }
      );
    }
  }
}
