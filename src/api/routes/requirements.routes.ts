import { Router, type Request, type Response } from 'express';
import { TaskStore } from '../../task-board/task-store.js';
import { SSEBroadcaster } from '../sse.js';
import { ApiError } from '../middleware/error-handler.js';
import { generateId } from '../../utils/id-generator.js';

export function createRequirementsRoutes(
  taskStore: TaskStore,
  sse: SSEBroadcaster
): Router {
  const router = Router();

  // POST /api/requirements - Submit a new requirement
  router.post('/', async (req: Request, res: Response) => {
    const { title, description, priority } = req.body;

    if (!title || !description) {
      throw new ApiError(400, 'Title and description are required');
    }

    const requirementId = generateId('req');

    // Create the requirement as a task assigned to team_leader for decomposition
    // The task starts as 'pending'. The Team Leader agent's taskCreatedHandler
    // will pick it up and transition it to 'in_progress' automatically.
    const task = await taskStore.create({
      title,
      description,
      assignee: 'team_leader',
      priority: priority || 'medium',
      requirement_id: requirementId,
    });

    sse.broadcast('requirement_submitted', {
      requirement_id: requirementId,
      task_id: task.id,
      title,
    });

    res.status(201).json({
      id: requirementId,
      task_id: task.id,
      title,
      description,
      status: task.status,
      created_at: task.created_at,
    });
  });

  // GET /api/requirements - List all requirements
  router.get('/', async (_req: Request, res: Response) => {
    const allTasks = await taskStore.list();

    // Group tasks by requirement_id
    const requirements = new Map<string, any>();

    for (const task of allTasks) {
      const reqId = task.requirement_id;
      if (!requirements.has(reqId)) {
        requirements.set(reqId, {
          id: reqId,
          title: task.title,
          tasks: [],
          total_tasks: 0,
          completed_tasks: 0,
          status: 'in_progress',
        });
      }

      const req = requirements.get(reqId);
      req.tasks.push({
        id: task.id,
        title: task.title,
        assignee: task.assignee,
        status: task.status,
      });
      req.total_tasks++;
      if (task.status === 'completed') {
        req.completed_tasks++;
      }
    }

    // Determine requirement status
    for (const [_id, req] of requirements) {
      if (req.completed_tasks === req.total_tasks && req.total_tasks > 0) {
        req.status = 'completed';
      } else if (req.completed_tasks > 0) {
        req.status = 'in_progress';
      }
    }

    const result = Array.from(requirements.values());
    res.json({ requirements: result, total: result.length });
  });

  // GET /api/requirements/:id - Get requirement detail
  router.get('/:id', async (req: Request, res: Response) => {
    const reqId = req.params.id as string;
    const tasks = await taskStore.list({ requirement_id: reqId });

    if (tasks.length === 0) {
      throw new ApiError(404, `Requirement not found: ${req.params.id}`);
    }

    const completed = tasks.filter((t) => t.status === 'completed').length;
    const total = tasks.length;

    res.json({
      id: req.params.id,
      title: tasks[0].title,
      tasks,
      progress: {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    });
  });

  // POST /api/requirements/:id/retrigger - Re-trigger a completed/failed requirement
  router.post('/:id/retrigger', async (req: Request, res: Response) => {
    const reqId = req.params.id as string;

    // Find existing tasks for this requirement
    const existingTasks = await taskStore.list({ requirement_id: reqId });

    if (existingTasks.length === 0) {
      throw new ApiError(404, `Requirement not found: ${reqId}`);
    }

    // Find the original parent task (assigned to team_leader with a description)
    const parentTask = existingTasks.find(
      (t) => t.assignee === 'team_leader' && t.description
    ) || existingTasks[0];

    // Create a new decomposition task for Team Leader
    const task = await taskStore.create({
      title: parentTask.title,
      description: parentTask.description,
      assignee: 'team_leader',
      priority: parentTask.priority,
      requirement_id: reqId,
    });

    // Broadcast the retrigger event
    sse.broadcast('requirement_retriggered', {
      requirement_id: reqId,
      task_id: task.id,
      title: parentTask.title,
      status: task.status,
    });

    res.status(201).json({
      id: reqId,
      task_id: task.id,
      title: parentTask.title,
      description: parentTask.description,
      status: task.status,
      created_at: task.created_at,
    });
  });

  return router;
}
