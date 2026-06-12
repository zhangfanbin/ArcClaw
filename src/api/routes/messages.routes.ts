import { Router, type Request, type Response } from 'express';
import { MessageBus } from '../../messaging/message-bus.js';
import { SSEBroadcaster } from '../sse.js';

export function createMessagesRoutes(
  messageBus: MessageBus,
  sse: SSEBroadcaster
): Router {
  const router = Router();

  // GET /api/messages - List messages with filters
  router.get('/', async (req: Request, res: Response) => {
    const { from, to, type } = req.query;

    const messages = await messageBus.getMessages(to as any, {
      type: type as any,
    });

    // Filter by sender if specified
    const filtered = from
      ? messages.filter((m) => m.from === from)
      : messages;

    res.json({ messages: filtered, total: filtered.length });
  });

  return router;
}
