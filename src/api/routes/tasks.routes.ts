import { Router, type Request, type Response } from 'express';
import { TaskStore } from '../../task-board/task-store.js';
import { SSEBroadcaster } from '../sse.js';
import { ApiError } from '../middleware/error-handler.js';

export function createTasksRoutes(taskStore: TaskStore, sse: SSEBroadcaster): Router {
  const router = Router();

  // GET /api/tasks - List tasks with optional filters
  router.get('/', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const assignee = req.query.assignee as string | undefined;
      const requirement_id = req.query.requirement_id as string | undefined;
      const priority = req.query.priority as string | undefined;
      const tasks = await taskStore.list({
        status: status as any,
        assignee: assignee as any,
        requirement_id,
        priority: priority as any,
      });
      res.json({ tasks, total: tasks.length });
    } catch (error: any) {
      throw new ApiError(500, error.message);
    }
  });

  // GET /api/tasks/:id - Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    const taskId = req.params.id as string;
    const task = await taskStore.get(taskId);
    if (!task) {
      throw new ApiError(404, `Task not found: ${taskId}`);
    }
    res.json(task);
  });

  // POST /api/tasks - Create task (admin override)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const task = await taskStore.create(req.body);
      sse.broadcast('task_created', task);
      res.status(201).json(task);
    } catch (error: any) {
      throw new ApiError(400, error.message);
    }
  });

  // PATCH /api/tasks/:id - Update task
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const { status, ...changes } = req.body;

      let task;
      if (status) {
        task = await taskStore.transitionStatus(
          taskId,
          status,
          req.body.reason || 'Manual update via API',
          'user'
        );
      } else {
        task = await taskStore.update(taskId, changes);
      }

      sse.broadcast('task_updated', task);
      res.json(task);
    } catch (error: any) {
      throw new ApiError(400, error.message);
    }
  });

  return router;
}
