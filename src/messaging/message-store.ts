import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentMessage, SendMessageInput } from '../types/message.js';
import { writeJSON, readJSON, listJSONFiles } from '../utils/json-persist.js';
import { generateId } from '../utils/id-generator.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('message-store');

export class MessageStore {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = path.join(dataDir, 'messages');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  /**
   * Persist a new message to disk.
   */
  async save(input: SendMessageInput): Promise<AgentMessage> {
    const now = new Date();
    const id = generateId('msg');
    const timestamp = now.toISOString();

    // Filename format: {timestamp}_{id}.json for chronological ordering
    const safeTs = now.getTime().toString(36);
    const filename = `${safeTs}_${id}.json`;

    const message: AgentMessage = {
      id,
      from: input.from,
      to: input.to,
      type: input.type,
      subject: input.subject,
      body: input.body,
      metadata: input.metadata ?? {},
      timestamp,
      read: false,
    };

    const filePath = path.join(this.dataDir, filename);
    await writeJSON(filePath, message);

    logger.info(
      { messageId: id, from: input.from, to: input.to, type: input.type },
      'Message saved'
    );

    return message;
  }

  /**
   * Mark a message as read.
   */
  async markAsRead(messageId: string): Promise<void> {
    const files = await listJSONFiles(this.dataDir);

    for (const file of files) {
      const msg = await readJSON<AgentMessage>(file);
      if (msg && msg.id === messageId) {
        await writeJSON(file, { ...msg, read: true });
        return;
      }
    }
  }

  /**
   * Get messages with optional filters.
   */
  async list(filter?: {
    from?: string;
    to?: string;
    type?: string;
    unreadOnly?: boolean;
  }): Promise<AgentMessage[]> {
    const files = await listJSONFiles(this.dataDir);
    const messages: AgentMessage[] = [];

    for (const file of files) {
      const msg = await readJSON<AgentMessage>(file);
      if (msg) {
        messages.push(msg);
      }
    }

    if (!filter) return messages;

    return messages.filter((msg) => {
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to && msg.to !== 'all') return false;
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.unreadOnly && msg.read) return false;
      return true;
    });
  }

  /**
   * Get all messages for a specific agent (sent or received, including broadcasts).
   */
  async getForAgent(agentId: string): Promise<AgentMessage[]> {
    return this.list({ to: agentId });
  }

  getDataDir(): string {
    return this.dataDir;
  }
}
