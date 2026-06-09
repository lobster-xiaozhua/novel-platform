import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode } from '@novel/shared';
import pino from 'pino';

const logger = pino();

function requireAuth(req: Request) {
  if (!req.user) throw new AppError(ErrorCode.UNAUTHORIZED, '未登录', 401);
}

export function createBookshelfRouter() {
  const router = Router();

  // GET / — 获取我的书架
  router.get('/', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const items = await prisma.bookshelf.findMany({
        where: { userId: req.user!.userId },
        include: {
          novel: { select: { id: true, title: true, coverUrl: true, status: true } },
        },
        orderBy: { addedAt: 'desc' },
      });

      _res.json({ code: 0, data: items, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // POST /:novelId — 加入书架
  router.post('/:novelId', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const { novelId } = req.params;
      const userId = req.user!.userId;

      const novel = await prisma.novel.findUnique({ where: { id: novelId } });
      if (!novel) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '小说不存在', 404);

      const existing = await prisma.bookshelf.findUnique({
        where: { userId_novelId: { userId, novelId } },
      });
      if (existing) throw new AppError(ErrorCode.BOOKSHELF_EXISTS, '已在书架中', 409);

      const item = await prisma.bookshelf.create({
        data: { userId, novelId },
        include: { novel: { select: { id: true, title: true, coverUrl: true, status: true } } },
      });

      logger.info({ userId, novelId }, '加入书架成功');

      _res.status(201).json({ code: 0, data: item, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:novelId — 移出书架
  router.delete('/:novelId', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const { novelId } = req.params;
      const userId = req.user!.userId;

      const existing = await prisma.bookshelf.findUnique({
        where: { userId_novelId: { userId, novelId } },
      });
      if (!existing) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '书架记录不存在', 404);

      await prisma.bookshelf.delete({
        where: { userId_novelId: { userId, novelId } },
      });

      logger.info({ userId, novelId }, '移出书架成功');

      _res.json({ code: 0, data: null, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:novelId — 更新阅读进度
  router.put('/:novelId', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const { novelId } = req.params;
      const userId = req.user!.userId;
      const { lastChapterId } = req.body;

      if (!lastChapterId || typeof lastChapterId !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'lastChapterId 必填', 400);
      }

      const existing = await prisma.bookshelf.findUnique({
        where: { userId_novelId: { userId, novelId } },
      });
      if (!existing) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '书架记录不存在', 404);

      const updated = await prisma.bookshelf.update({
        where: { userId_novelId: { userId, novelId } },
        data: { lastChapterId },
        include: { novel: { select: { id: true, title: true, coverUrl: true, status: true } } },
      });

      logger.info({ userId, novelId, lastChapterId }, '更新阅读进度成功');

      _res.json({ code: 0, data: updated, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
