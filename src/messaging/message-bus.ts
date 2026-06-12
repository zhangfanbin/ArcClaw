import type {
  AgentMessage,
  SendMessageInput,
  MessageType,
} from '../types/message.js';
import type { AgentId } from '../types/agent.js';
import { createLogger } from '../utils/logger.js';
import { MessageStore } from './message-store.js';
import { FileWatcher } from './file-watcher.js';
import { MessageRouter } from './message-router.js';

const logger = createLogger('message-bus');

export class MessageBus {
  private store: MessageStore;
  private fileWatcher: FileWatcher;
  private router: MessageRouter;

  constructor(dataDir: string) {
    this.store = new MessageStore(dataDir);
    this.fileWatcher = new FileWatcher(this.store.getDataDir());
    this.router = new MessageRouter(this.fileWatcher);
  }

  async init(): Promise<void> {
    await this.store.init();
    this.fileWatcher.start();
    this.router.start();
    logger.info('Message bus initialized');
  }

  /**
   * Send a point-to-point message.
   */
  async send(input: SendMessageInput): Promise<AgentMessage> {
    const message = await this.store.save(input);
    return message;
  }

  /**
   * Broadcast a message to all agents.
   */
  async broadcast(
    from: AgentId,
    type: MessageType,
    subject: string,
    body: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentMessage> {
    return this.send({
      from,
      to: 'all',
      type,
      subject,
      body,
      metadata,
    });
  }

  /**
   * Get messages for an agent.
   */
  async getMessages(
    forAgent: AgentId,
    options?: { unreadOnly?: boolean; type?: MessageType }
  ): Promise<AgentMessage[]> {
    const allMessages = await this.store.list({
      to: forAgent,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.unreadOnly ? { unreadOnly: true } : {}),
    });

    // Also include broadcasts
    const broadcasts = await this.store.list({
      to: 'all',
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.unreadOnly ? { unreadOnly: true } : {}),
    });

    return [...allMessages, ...broadcasts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Subscribe to messages for a specific agent.
   */
  onMessage(
    forAgent: AgentId,
    handler: (message: AgentMessage) => void
  ): () => void {
    return this.router.onMessageFor(forAgent, handler);
  }

  /**
   * Subscribe to broadcast messages.
   */
  onBroadcast(handler: (message: AgentMessage) => void): () => void {
    return this.router.onMessageFor('all', handler);
  }

  /**
   * Subscribe to all messages (for monitoring).
   */
  onAnyMessage(handler: (message: AgentMessage) => void): () => void {
    return this.router.onAnyMessage(handler);
  }

  /**
   * Mark a message as read.
   */
  async markAsRead(messageId: string): Promise<void> {
    return this.store.markAsRead(messageId);
  }

  /**
   * Shutdown the message bus.
   */
  async shutdown(): Promise<void> {
    await this.fileWatcher.stop();
    logger.info('Message bus shutdown');
  }
}
