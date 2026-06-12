import lockfile from 'proper-lockfile';
import { createLogger } from './logger.js';

const logger = createLogger('file-lock');

/**
 * Execute a function while holding a lock on the given file path.
 * Automatically releases the lock after the function completes (or throws).
 */
export async function withLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  options?: { stale?: number; retries?: number }
): Promise<T> {
  const stale = options?.stale ?? 10000;
  const retries = options?.retries ?? 5;

  try {
    const release = await lockfile.lock(filePath, {
      stale,
      retries: {
        retries,
        minTimeout: 50,
        maxTimeout: 500,
        randomize: true,
      },
    });

    try {
      return await fn();
    } finally {
      await release();
    }
  } catch (error: any) {
    logger.error(
      { filePath, error: error.message },
      'Failed to acquire file lock'
    );
    throw error;
  }
}
