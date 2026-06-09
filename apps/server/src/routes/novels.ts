import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, Roles } from '@novel/shared';
import { createNovelSchema, updateNovelSchema, paginationSchema } from '@novel/shared';
import pino from 'pino';

const logger = pino();

const roleLevel: Record<string, number> = {
  [Roles.READER]: 0,
  [Roles.AUTHOR]: 1,
  [Roles.ADMIN]: 2,
};

function requireAuth(req: Request) {
  if (!req.user) throw new AppError(ErrorCode.UNAUTHORIZED, '未登录', 401);
}

function requireRole(req: Request, minRole: string) {
  requireAuth(req);
  if (roleLevel[req.user!.role] < roleLevel[minRole]) {
    throw new AppError(ErrorCode.FORBIDDEN, '权限不足', 403);
  }
}

function isOwnerOrAdmin(req: Request, authorId: string) {
  if (req.user!.role === Roles.ADMIN) return;
  if (req.user!.userId !== authorId) {
    throw new AppError(ErrorCode.FORBIDDEN, '权限不足', 403);
  }
}

function validate<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new AppError(ErrorCode.VALIDATION_ERROR, message, 400);
    }
    throw err;
  }
}

export function createNovelRouter() {
  const router = Router();

  // GET / — 小说列表（公开，只返回已发布）
  router.get('/', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { page, limit } = validate(paginationSchema, req.query);
      const { category, status, sortBy, order } = req.query as Record<string, string>;

      const where: any = { isPublished: true };
      if (category) where.category = category;
      if (status) where.status = status;

      const allowedSorts = ['updatedAt', 'wordCount', 'viewCount'];
      const sortField = allowedSorts.includes(sortBy) ? sortBy : 'updatedAt';
      const sortOrder = order === 'asc' ? 'asc' : 'desc';

      const [items, total] = await Promise.all([
        prisma.novel.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortField]: sortOrder },
        }),
        prisma.novel.count({ where }),
      ]);

      _res.json({
        code: 0,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        message: 'ok',
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — 小说详情
  router.get('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const novel = await prisma.novel.findUnique({
        where: { id: req.params.id },
        include: { author: { select: { username: true, avatarUrl: true } } },
      });

      if (!novel) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '小说不存在', 404);

      _res.json({ code: 0, data: novel, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // POST / — 创建小说
  router.post('/', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireRole(req, Roles.AUTHOR);

      const data = validate(createNovelSchema, req.body);

      const novel = await prisma.novel.create({
        data: { ...data, authorId: req.user!.userId },
      });

      logger.info({ novelId: novel.id, authorId: req.user!.userId }, '小说创建成功');

      _res.status(201).json({ code: 0, data: novel, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id — 更新小说
  router.put('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const novel = await prisma.novel.findUnique({ where: { id: req.params.id } });
      if (!novel) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '小说不存在', 404);

      isOwnerOrAdmin(req, novel.authorId);

      const data = validate(updateNovelSchema, req.body);

      const updated = await prisma.novel.update({
        where: { id: req.params.id },
        data,
      });

      logger.info({ novelId: updated.id, userId: req.user!.userId }, '小说更新成功');

      _res.json({ code: 0, data: updated, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — 删除小说
  router.delete('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const novel = await prisma.novel.findUnique({ where: { id: req.params.id } });
      if (!novel) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '小说不存在', 404);

      isOwnerOrAdmin(req, novel.authorId);

      await prisma.novel.delete({ where: { id: req.params.id } });

      logger.info({ novelId: req.params.id, userId: req.user!.userId }, '小说删除成功');

      _res.json({ code: 0, data: null, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
