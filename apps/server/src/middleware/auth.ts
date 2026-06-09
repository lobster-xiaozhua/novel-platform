import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { ErrorCode, Roles } from '@novel/shared';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function auth(requiredRole?: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new AppError(ErrorCode.UNAUTHORIZED, '未登录', 401);
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthPayload;
      req.user = payload;

      if (requiredRole) {
        const roleLevel = { [Roles.READER]: 0, [Roles.AUTHOR]: 1, [Roles.ADMIN]: 2 };
        if (roleLevel[payload.role as keyof typeof roleLevel] < roleLevel[requiredRole as keyof typeof roleLevel]) {
          throw new AppError(ErrorCode.FORBIDDEN, '权限不足', 403);
        }
      }

      next();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Token已过期', 401);
    }
  };
}
