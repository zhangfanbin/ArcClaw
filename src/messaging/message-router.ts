import { EventEmitter } from 'node:events';
import type { AgentMessage } from '../types/message.js';
import type { AgentId } from '../types/agent.js';
import { readJSON } from '../utils/json-persist.js';
import { createLogger } from '../utils/logger.js';
import { FileWatcher } from './file-watcher.js';

const logger = createLogger('message-router');

export class MessageRouter extends EventEmitter {
  private fileWatcher: FileWatcher;
  private processedFiles: Set<string> = new Set();

  constructor(fileWatcher: FileWatcher) {
    super();
    this.fileWatcher = fileWatcher;
  }

  /**
   * Start routing messages from file watcher to agent event handlers.
   */
  start(): void {
    this.fileWatcher.onNewFile(async (filePath) => {
      // Skip if already processed
      if (this.processedFiles.has(filePath)) return;
      this.processedFiles.add(filePath);

      const message = await readJSON<AgentMessage>(filePath);
      if (!message) {
        logger.warn({ filePath }, 'Failed to read message file');
        return;
      }

      this.routeMessage(message);
    });

    logger.info('Message router started');
  }

  /**
   * Route a message to the appropriate agent(s).
   */
  private routeMessage(message: AgentMessage): void {
    if (message.to === 'all') {
      // Broadcast to all agents
      logger.info(
        { messageId: message.id, from: message.from, type: 'broadcast' },
        'Routing broadcast message'
      );
      this.emit('message:all', message);
    } else {
      // Point-to-point message
      logger.info(
        {
          messageId: message.id,
          from: message.from,
          to: message.to,
          type: message.type,
        },
        'Routing message'
      );
      this.emit(`message:${message.to}`, message);
    }

    // Also emit a general 'message' event for logging/monitoring
    this.emit('message', message);
  }

  /**
   * Subscribe to messages for a specific agent.
   */
  onMessageFor(
    agentId: AgentId | 'all',
    handler: (message: AgentMessage) => void
  ): () => void {
    const event = `message:${agentId}`;
    this.on(event, handler);
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to all messages (for monitoring/logging).
   */
  onAnyMessage(handler: (message: AgentMessage) => void): () => void {
    this.on('message', handler);
    return () => {
      this.off('message', handler);
    };
  }
}
