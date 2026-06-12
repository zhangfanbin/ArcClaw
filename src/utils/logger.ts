import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

let baseLogger: pino.Logger | null = null;

function getBaseLogger(): pino.Logger {
  if (!baseLogger) {
    const LOG_DIR = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, 'audit')
      : './data/audit';

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
