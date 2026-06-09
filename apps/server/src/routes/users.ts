import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, Roles, updateProfileSchema } from '@novel/shared';
import pino from 'pino';

const logger = pino();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function omitPassword(user: Record<string, unknown>) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function requireAuth(req: Request) {
  if (!req.user) throw new AppError(ErrorCode.UNAUTHORIZED, '未登录', 401);
}

const roleLevel: Record<string, number> = {
  [Roles.READER]: 0,
  [Roles.AUTHOR]: 1,
  [Roles.ADMIN]: 2,
};

function requireRole(req: Request, minRole: string) {
  requireAuth(req);
  if (roleLevel[req.user!.role] < roleLevel[minRole]) {
    throw new AppError(ErrorCode.FORBIDDEN, '权限不足', 403);
  }
}

export function createUserRouter() {
  const router = Router();

  // GET /me — 获取当前用户信息
  router.get('/me', wrap(async (req, res) => {
    requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在', 404);

    logger.info({ userId: user.id }, '获取用户信息');
    res.json({ code: 0, data: omitPassword(user), message: 'ok' });
  }));

  // PUT /me — 更新个人资料
  router.put('/me', wrap(async (req, res) => {
    requireAuth(req);
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues.map(i => i.message).join('; '), 400);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: parsed.data,
    });

    logger.info({ userId: user.id }, '用户资料更新成功');
    res.json({ code: 0, data: omitPassword(user), message: 'ok' });
  }));

  // POST /apply-author — 申请作者认证
  router.post('/apply-author', wrap(async (req, res) => {
    requireAuth(req);
    if (req.user!.role !== Roles.READER) {
      throw new AppError(ErrorCode.FORBIDDEN, '仅读者可申请作者认证', 403);
    }

    const existing = await prisma.authorApplication.findFirst({
      where: { userId: req.user!.userId, status: 'pending' },
    });
    if (existing) {
      logger.warn({ userId: req.user!.userId }, '重复申请作者认证');
      throw new AppError(ErrorCode.AUTHOR_APP_EXISTS, '已有待审核的作者申请', 400);
    }

    const application = await prisma.authorApplication.create({
      data: { userId: req.user!.userId },
    });

    logger.info({ userId: req.user!.userId, appId: application.id }, '作者认证申请提交成功');
    res.status(201).json({ code: 0, data: application, message: 'ok' });
  }));

  // POST /me/avatar — 头像上传（暂未实现）
  router.post('/me/avatar', wrap(async (_req, _res) => {
    throw new AppError(ErrorCode.INTERNAL_ERROR, '头像上传功能暂未实现', 501);
  }));

  return router;
}

// 向后兼容
export const userRouter = createUserRouter();
