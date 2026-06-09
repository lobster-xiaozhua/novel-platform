import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, registerSchema, loginSchema } from '@novel/shared';
import pino from 'pino';

const logger = pino();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TTL = '15m';
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

const COOKIE_ACCESS_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000,
  path: '/',
};

const COOKIE_REFRESH_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh',
};

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function signAccessToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
}

function omitPassword(user: Record<string, unknown>) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export function createAuthRouter() {
  const router = Router();

  // POST /register
  router.post('/register', wrap(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues.map(i => i.message).join('; '), 400);
    }

    const { username, email, password } = parsed.data;

    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) {
      logger.warn({ username }, '注册失败：用户名已存在');
      throw new AppError(ErrorCode.RESOURCE_EXISTS, '用户名已存在', 400);
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      logger.warn({ email }, '注册失败：邮箱已存在');
      throw new AppError(ErrorCode.RESOURCE_EXISTS, '邮箱已存在', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
    });

    logger.info({ userId: user.id, username }, '用户注册成功');
    res.status(201).json({ code: 0, data: omitPassword(user), message: 'ok' });
  }));

  // POST /login
  router.post('/login', wrap(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues.map(i => i.message).join('; '), 400);
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      logger.warn({ username }, '登录失败：用户不存在');
      throw new AppError(ErrorCode.UNAUTHORIZED, '用户名或密码错误', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.warn({ username }, '登录失败：密码错误');
      throw new AppError(ErrorCode.UNAUTHORIZED, '用户名或密码错误', 401);
    }

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = signRefreshToken(user.id, user.role);

    await redis.setex(`refresh:${user.id}`, REFRESH_TTL, refreshToken);

    logger.info({ userId: user.id, username }, '用户登录成功');
    res
      .cookie('accessToken', accessToken, COOKIE_ACCESS_OPTS)
      .cookie('refreshToken', refreshToken, COOKIE_REFRESH_OPTS)
      .json({ code: 0, data: omitPassword(user), message: 'ok' });
  }));

  // POST /refresh
  router.post('/refresh', wrap(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, '缺少刷新令牌', 401);
    }

    let payload: { userId: string; role: string };
    try {
      payload = jwt.verify(token, REFRESH_SECRET) as typeof payload;
    } catch {
      logger.warn('刷新令牌验证失败');
      throw new AppError(ErrorCode.TOKEN_EXPIRED, '刷新令牌无效或已过期', 401);
    }

    const stored = await redis.get(`refresh:${payload.userId}`);
    if (stored !== token) {
      logger.warn({ userId: payload.userId }, '刷新令牌与存储不匹配');
      throw new AppError(ErrorCode.TOKEN_EXPIRED, '刷新令牌无效或已过期', 401);
    }

    const accessToken = signAccessToken(payload.userId, payload.role);
    const refreshToken = signRefreshToken(payload.userId, payload.role);

    await redis.setex(`refresh:${payload.userId}`, REFRESH_TTL, refreshToken);

    logger.info({ userId: payload.userId }, '令牌刷新成功');
    res
      .cookie('accessToken', accessToken, COOKIE_ACCESS_OPTS)
      .cookie('refreshToken', refreshToken, COOKIE_REFRESH_OPTS)
      .json({ code: 0, data: null, message: 'ok' });
  }));

  // POST /logout
  router.post('/logout', wrap(async (req, res) => {
    const token = req.cookies?.accessToken;
    if (token) {
      try {
        const payload = jwt.verify(token, ACCESS_SECRET) as { userId: string; role: string };
        await redis.del(`refresh:${payload.userId}`);
        logger.info({ userId: payload.userId }, '用户登出');
      } catch {
        logger.warn('登出时访问令牌验证失败，仍清除 Cookie');
      }
    }

    res
      .clearCookie('accessToken', { ...COOKIE_ACCESS_OPTS, maxAge: 0 })
      .clearCookie('refreshToken', { ...COOKIE_REFRESH_OPTS, maxAge: 0 })
      .json({ code: 0, data: null, message: 'ok' });
  }));

  return router;
}

// 保持向后兼容的默认导出
export const authRouter = createAuthRouter();
