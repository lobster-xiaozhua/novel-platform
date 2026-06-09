import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@novel/shared';
import pino from 'pino';

const logger = pino();

export class AppError extends Error {
  constructor(
    public code: number,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, message: err.message });
    return res.status(err.statusCode).json({
      code: err.code,
      data: null,
      message: err.message,
    });
  }

  logger.error({ err: err.message, stack: err.stack });
  return res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    data: null,
    message: '服务器内部错误',
  });
}
