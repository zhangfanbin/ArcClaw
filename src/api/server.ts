import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { TaskStore } from '../task-board/task-store.js';
import { MessageBus } from '../messaging/message-bus.js';
import { AgentRunner } from '../agent/agent-runner.js';
import { SSEBroadcaster } from './sse.js';
import { LLMLogger } from '../llm/llm-logger.js';
import { createTasksRoutes } from './routes/tasks.routes.js';
import { createAgentsRoutes } from './routes/agents.routes.js';
import { createMessagesRoutes } from './routes/messages.routes.js';
import { createRequirementsRoutes } from './routes/requirements.routes.js';
import { createLLMLogsRoutes } from './routes/llm-logs.routes.js';
import { errorHandler, requestLogger } from './middleware/error-handler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('api-server');

export interface ApiServerDeps {
  taskStore: TaskStore;
  messageBus: MessageBus;
  agentRunner: AgentRunner;
  sse: SSEBroadcaster;
  llmLogger: LLMLogger;
  port: number;
  host: string;
}

export interface ApiServer {
  app: Express;
  start: () => Promise<void>;
}

export function createApiServer(deps: ApiServerDeps): ApiServer {
  const { taskStore, messageBus, agentRunner, sse, llmLogger, port, host } = deps;
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      agents: agentRunner.getAllStatus().length,
      sse_clients: sse.getClientCount(),
    });
  });

  // SSE endpoint
  app.get('/api/events', (req, res) => {
    sse.addClient(res);
  });

  // Routes
  app.use('/api/tasks', createTasksRoutes(taskStore, sse));
  app.use('/api/agents', createAgentsRoutes(agentRunner, messageBus, sse));
  app.use('/api/messages', createMessagesRoutes(messageBus, sse));
  app.use('/api/requirements', createRequirementsRoutes(taskStore, sse));
  app.use('/api/llm-logs', createLLMLogsRoutes(llmLogger));

  // Error handler
  app.use(errorHandler);

  // Wire up SSE broadcasting from task store events
  taskStore.getWatcher().onTaskCreated((task) => {
    sse.broadcast('task_created', task);
  });
  taskStore.getWatcher().onTaskUpdated((task) => {
    sse.broadcast('task_updated', task);
  });
  taskStore.getWatcher().onTaskStatusChanged((task, oldStatus, newStatus) => {
    sse.broadcast('task_status_changed', { task, oldStatus, newStatus });
  });

  // Wire up SSE broadcasting from message bus
  messageBus.onAnyMessage((message) => {
    sse.broadcast('new_message', message);
  });

  return {
    app,
    start: () => {
      return new Promise<void>((resolve) => {
        app.listen(port, host, () => {
          logger.info({ port, host }, 'API server started');
          resolve();
        });
      });
    },
  };
}
