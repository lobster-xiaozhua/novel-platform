import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, Roles, paginationSchema } from '@novel/shared';
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

export function createAdminRouter() {
  const router = Router();

  // GET /author-applications — 获取作者申请列表
  router.get('/author-applications', wrap(async (req, res) => {
    requireRole(req, Roles.ADMIN);
    const { page, limit } = paginationSchema.parse(req.query);
    const { status } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.authorApplication.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, username: true, email: true, role: true } } },
      }),
      prisma.authorApplication.count({ where }),
    ]);

    res.json({
      code: 0,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
      message: 'ok',
    });
  }));

  // PUT /author-applications/:id — 审批作者申请
  router.put('/author-applications/:id', wrap(async (req, res) => {
    requireRole(req, Roles.ADMIN);
    const { id } = req.params;
    const { action } = req.body as { action: string };

    if (!['approve', 'reject'].includes(action)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'action 必须为 approve 或 reject', 400);
    }

    const application = await prisma.authorApplication.findUnique({ where: { id } });
    if (!application) {
      throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '申请不存在', 404);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const reviewedAt = new Date();

    const updated = await prisma.authorApplication.update({
      where: { id },
      data: { status: newStatus, reviewedBy: req.user!.userId, reviewedAt },
    });

    if (action === 'approve') {
      await prisma.user.update({
        where: { id: application.userId },
        data: { role: Roles.AUTHOR },
      });
      logger.info({ appId: id, userId: application.userId, adminId: req.user!.userId }, '作者申请已批准，用户角色升级');
    } else {
      logger.info({ appId: id, userId: application.userId, adminId: req.user!.userId }, '作者申请已拒绝');
    }

    res.json({ code: 0, data: updated, message: 'ok' });
  }));

  // GET /users — 获取用户列表
  router.get('/users', wrap(async (req, res) => {
    requireRole(req, Roles.ADMIN);
    const { page, limit } = paginationSchema.parse(req.query);
    const { role } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      code: 0,
      data: { items: items.map(omitPassword), total, page, limit, totalPages: Math.ceil(total / limit) },
      message: 'ok',
    });
  }));

  return router;
}

// 向后兼容
export const adminRouter = createAdminRouter();
