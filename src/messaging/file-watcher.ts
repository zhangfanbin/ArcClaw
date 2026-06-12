import { watch, type FSWatcher } from 'chokidar';
import path from 'node:path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('file-watcher');

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private dataDir: string;
  private handlers: Set<(filePath: string) => void> = new Set();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Start watching the messages directory for new files.
   */
  start(): void {
    if (this.watcher) {
      logger.warn('File watcher already started');
      return;
    }

    this.watcher = watch(this.dataDir, {
      persistent: true,
      ignoreInitial: true, // Don't emit for existing files
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
      depth: 0, // Only watch top-level files
    });

    this.watcher.on('add', (filePath) => {
      if (filePath.endsWith('.json')) {
        logger.debug({ filePath: path.basename(filePath) }, 'New message file detected');
        for (const handler of this.handlers) {
          try {
            handler(filePath);
          } catch (error) {
            logger.error({ error, filePath }, 'Error in file watcher handler');
          }
        }
      }
    });

    this.watcher.on('error', (error) => {
      logger.error({ error }, 'File watcher error');
    });

    logger.info({ dataDir: this.dataDir }, 'File watcher started');
  }

  /**
   * Register a handler for new message files.
   */
  onNewFile(handler: (filePath: string) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Stop watching.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.handlers.clear();
      logger.info('File watcher stopped');
    }
  }
}
