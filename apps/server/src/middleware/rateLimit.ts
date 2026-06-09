import { Request, Response, NextFunction } from 'express';
import { RateLimitConfig } from '@novel/shared';
import { AppError } from './errorHandler';
import { ErrorCode } from '@novel/shared';

// 简易内存限流（后续替换为 Redis）
const stores = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(type: 'login' | 'api' | 'search') {
  const config = RateLimitConfig[type.toUpperCase() as keyof typeof RateLimitConfig];

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${type}:${req.ip}`;
    const now = Date.now();
    const record = stores.get(key);

    if (!record || now > record.resetAt) {
      stores.set(key, { count: 1, resetAt: now + config.windowMs });
      return next();
    }

    if (record.count >= config.max) {
      throw new AppError(ErrorCode.UNAUTHORIZED, '请求过于频繁，请稍后再试', 429);
    }

    record.count++;
    next();
  };
}
