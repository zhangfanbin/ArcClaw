import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

let baseLogger: pino.Logger | null = null;
let injectedAuditDir: string | null = null;

/**
 * Inject the audit directory path. Call this during bootstrap after
 * runtime-init resolves the .arcclaw/ directory structure.
 * Forces the base logger to be recreated on next use.
 */
export function setAuditDir(dir: string): void {
  injectedAuditDir = dir;
  baseLogger = null; // Force recreation on next getBaseLogger() call
}

function resolveAuditDir(): string {
  // 1. Explicitly injected (preferred)
  if (injectedAuditDir) return injectedAuditDir;

  // 2. ARCCLAW_HOME env var
  const arcclawHome = process.env.ARCCLAW_HOME;
  if (arcclawHome) return path.join(arcclawHome, 'data', 'audit');

  // 3. Legacy DATA_DIR env var (backward compat)
  const legacyDataDir = process.env.DATA_DIR;
  if (legacyDataDir) return path.join(legacyDataDir, 'audit');

  // 4. Default fallback
  return path.join('.arcclaw', 'data', 'audit');
}

function getBaseLogger(): pino.Logger {
  if (!baseLogger) {
    const LOG_DIR = resolveAuditDir();

    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    baseLogger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        targets: [
          {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
          {
            target: 'pino/file',
            options: {
              destination: path.join(LOG_DIR, 'arcclaw.log'),
              mkdir: true,
            },
          },
        ],
      },
    });
  }
  return baseLogger;
}

export function createLogger(module: string, extra?: Record<string, unknown>) {
  return getBaseLogger().child({ module, ...extra });
}

/** Access the root logger (initializes on first call). */
export function getLogger(): pino.Logger {
  return getBaseLogger();
}
