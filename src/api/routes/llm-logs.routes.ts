import { Router, type Request, type Response } from 'express';
import { LLMLogger } from '../../llm/llm-logger.js';

export function createLLMLogsRoutes(llmLogger: LLMLogger): Router {
  const router = Router();

  // GET /api/llm-logs - List LLM call logs (most recent first)
  router.get('/', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await llmLogger.list(limit, offset);
    res.json(result);
  });

  // GET /api/llm-logs/:id - Get a single log entry
  router.get('/:id', async (req: Request, res: Response) => {
    const entry = await llmLogger.get(req.params.id as string);
    if (!entry) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    res.json(entry);
  });

  return router;
}
