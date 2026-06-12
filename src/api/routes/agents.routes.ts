import { Router, type Request, type Response } from 'express';
import { AgentRunner } from '../../agent/agent-runner.js';
import { MessageBus } from '../../messaging/message-bus.js';
import { SSEBroadcaster } from '../sse.js';
import { ApiError } from '../middleware/error-handler.js';
import type { AgentId } from '../../types/agent.js';

export function createAgentsRoutes(
  agentRunner: AgentRunner,
  messageBus: MessageBus,
  sse: SSEBroadcaster
): Router {
  const router = Router();

  // GET /api/agents - Get all agent statuses
  router.get('/', (_req: Request, res: Response) => {
    const statuses = agentRunner.getAllStatus();
    res.json({ agents: statuses });
  });

  // GET /api/agents/:id - Get single agent status
  router.get('/:id', (req: Request, res: Response) => {
    const status = agentRunner.getStatus(req.params.id as AgentId);
    if (!status) {
      throw new ApiError(404, `Agent not found: ${req.params.id}`);
    }
    res.json(status);
  });

  // POST /api/agents/:id/message - Send message to agent
  router.post('/:id/message', async (req: Request, res: Response) => {
    const agentId = req.params.id as AgentId;
    const status = agentRunner.getStatus(agentId);
    if (!status) {
      throw new ApiError(404, `Agent not found: ${agentId}`);
    }

    const { type, subject, body, metadata } = req.body;
    const message = await messageBus.send({
      from: 'team_leader', // Messages from dashboard come as team_leader
      to: agentId,
      type: type || 'question',
      subject: subject || 'Dashboard Message',
      body: body || '',
      metadata: metadata || {},
    });

    sse.broadcast('new_message', message);
    res.status(201).json(message);
  });

  return router;
}
