import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('error-handler');

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  logger.error(
    {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500,
  });
}

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  logger.info({ method: req.method, path: req.path, query: req.query }, 'Request');
  next();
}
