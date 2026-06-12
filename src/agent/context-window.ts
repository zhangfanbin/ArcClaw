import type { ChatMessage } from '../types/llm.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('context-window');

export interface ContextWindowConfig {
  tokenBudget: number;
  reservedForResponse: number;
}

/**
 * Manages an agent's conversation context window.
 * Implements a sliding window with automatic summarization when approaching token limits.
 */
export class ContextWindow {
  private messages: ChatMessage[] = [];
  private estimatedTokens: number = 0;
  private config: ContextWindowConfig;

  constructor(config: ContextWindowConfig) {
    this.config = config;
  }

  /**
   * Add a message to the context window.
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.estimatedTokens += this.estimateTokens(message.content);
  }

  /**
   * Get all messages in the context window.
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Get current estimated token count.
   */
  getTokenCount(): number {
    return this.estimatedTokens;
  }

  /**
   * Check if we're approaching the token budget.
   */
  isNearLimit(threshold = 0.8): boolean {
    return this.estimatedTokens > this.config.tokenBudget * threshold;
  }

  /**
   * Trim old messages to stay within budget.
   * Preserves system message and recent N messages.
   */
  trimToBudget(preserveRecent = 10): void {
    if (!this.isNearLimit()) return;

    const systemMessages = this.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = this.messages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length <= preserveRecent) return;

    const toKeep = nonSystemMessages.slice(-preserveRecent);
    const trimmed = nonSystemMessages.length - toKeep.length;

    logger.info(
      { trimmed, remaining: toKeep.length },
      'Trimmed context window'
    );

    // Add a summary of trimmed messages
    this.messages = [
      ...systemMessages,
      {
        role: 'user',
        content: `[Context: ${trimmed} earlier messages were summarized to manage context window]`,
      },
      ...toKeep,
    ];

    this.recalculateTokens();
  }

  /**
   * Clear all messages except system messages.
   */
  clearNonSystem(): void {
    this.messages = this.messages.filter((m) => m.role === 'system');
    this.recalculateTokens();
  }

  /**
   * Reset the entire context window.
   */
  reset(): void {
    this.messages = [];
    this.estimatedTokens = 0;
  }

  private recalculateTokens(): void {
    this.estimatedTokens = this.messages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0
    );
  }

  /**
   * Rough token estimation: ~4 chars per token for English text.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
