import path from 'node:path';
import fs from 'node:fs/promises';
import type { LLMLogEntry } from '../types/llm.js';
import { generateId } from '../utils/id-generator.js';
import { writeJSON, readJSON, listJSONFiles } from '../utils/json-persist.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('llm-logger');

export class LLMLogger {
  private logDir: string;
  private entries: LLMLogEntry[] = [];
  private maxInMemory = 500;

  constructor(dataDir: string) {
    this.logDir = path.join(dataDir, 'llm-logs');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    logger.info({ logDir: this.logDir }, 'LLM logger initialized');
  }

  /**
   * Log an LLM call.
   */
  async log(entry: Omit<LLMLogEntry, 'id' | 'timestamp'>): Promise<LLMLogEntry> {
    const id = generateId('llm');
    const fullEntry: LLMLogEntry = {
      ...entry,
      id,
      timestamp: new Date().toISOString(),
    };

    // Keep in-memory cache
    this.entries.push(fullEntry);
    if (this.entries.length > this.maxInMemory) {
      this.entries = this.entries.slice(-this.maxInMemory);
    }

    // Persist to disk
    const filePath = path.join(this.logDir, `${id}.json`);
    try {
      await writeJSON(filePath, fullEntry);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to write LLM log entry');
    }

    logger.info(
      {
        id,
        agentId: entry.agent_id,
        model: entry.model,
        tokens: entry.total_tokens,
        durationMs: entry.duration_ms,
      },
      'LLM call logged'
    );

    return fullEntry;
  }

  /**
   * List log entries, most recent first.
   */
  async list(limit = 50, offset = 0): Promise<{ entries: LLMLogEntry[]; total: number }> {
    const files = await listJSONFiles(this.logDir);

    // Sort by filename (which is ID-based, chronologically ordered) descending
    const sortedFiles = files.sort().reverse();

    const total = sortedFiles.length;
    const pageFiles = sortedFiles.slice(offset, offset + limit);

    const entries: LLMLogEntry[] = [];
    for (const file of pageFiles) {
      const entry = await readJSON<LLMLogEntry>(file);
      if (entry) entries.push(entry);
    }

    return { entries, total };
  }

  /**
   * Get a single log entry by ID.
   */
  async get(id: string): Promise<LLMLogEntry | null> {
    const filePath = path.join(this.logDir, `${id}.json`);
    return readJSON<LLMLogEntry>(filePath);
  }

  /**
   * Get recent entries from memory cache.
   */
  getRecent(count = 20): LLMLogEntry[] {
    return this.entries.slice(-count).reverse();
  }
}

/** Singleton instance — set during app startup. */
let instance: LLMLogger | null = null;

export function setLLMLogger(logger: LLMLogger): void {
  instance = logger;
}

export function getLLMLogger(): LLMLogger | null {
  return instance;
}
