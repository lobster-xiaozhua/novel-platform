import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import prisma from '../lib/prisma';
import meilisearch, { CHAPTERS_INDEX } from '../lib/meilisearch';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, Roles, createChapterSchema, updateChapterSchema } from '@novel/shared';
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

export function createChapterRouter() {
  const router = Router({ mergeParams: true });

  // GET / — 获取章节目录（只返回已发布的，按 sortOrder 排序，不含 content）
  router.get('/', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { novelId } = req.params;
      const chapters = await prisma.chapter.findMany({
        where: { novelId, isPublished: true },
        select: {
          id: true,
          novelId: true,
          title: true,
          wordCount: true,
          sortOrder: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      _res.json({ code: 0, data: chapters, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — 获取章节详情（含 content，未发布章节只有作者可看）
  router.get('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const chapter = await prisma.chapter.findUnique({
        where: { id: req.params.id },
        include: { novel: { select: { authorId: true } } },
      });

      if (!chapter) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '章节不存在', 404);

      // 未发布章节只有作者或管理员可看
      if (!chapter.isPublished) {
        if (!req.user) throw new AppError(ErrorCode.UNAUTHORIZED, '未登录', 401);
        isOwnerOrAdmin(req, chapter.novel.authorId);
      }

      _res.json({ code: 0, data: chapter, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // POST / — 创建章节（author+，自动计算 wordCount，sortOrder 自动递增）
  router.post('/', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireRole(req, Roles.AUTHOR);

      const data = validate(createChapterSchema, req.body);

      const { novelId } = req.params;

      // 验证小说存在
      const novel = await prisma.novel.findUnique({ where: { id: novelId } });
      if (!novel) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '小说不存在', 404);

      // 只有小说作者或管理员可以创建章节
      isOwnerOrAdmin(req, novel.authorId);
      const wordCount = data.content.length;

      // 获取当前最大 sortOrder
      const maxResult = await prisma.chapter.aggregate({
        where: { novelId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxResult._max.sortOrder ?? 0) + 1;

      const chapter = await prisma.chapter.create({
        data: {
          novelId,
          title: data.title,
          content: data.content,
          wordCount,
          sortOrder,
        },
      });

      logger.info({ chapterId: chapter.id, novelId, userId: req.user!.userId }, '章节创建成功');

      _res.status(201).json({ code: 0, data: chapter, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // PUT /:id — 更新章节（所有者或admin）
  router.put('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const chapter = await prisma.chapter.findUnique({
        where: { id: req.params.id },
        include: { novel: { select: { authorId: true } } },
      });
      if (!chapter) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '章节不存在', 404);

      isOwnerOrAdmin(req, chapter.novel.authorId);

      const data = validate(updateChapterSchema, req.body);

      // 如果更新了 content，重新计算 wordCount
      const updateData: any = { ...data };
      if (data.content) {
        updateData.wordCount = data.content.length;
      }

      const updated = await prisma.chapter.update({
        where: { id: req.params.id },
        data: updateData,
      });

      logger.info({ chapterId: updated.id, userId: req.user!.userId }, '章节更新成功');

      _res.json({ code: 0, data: updated, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — 删除章节（所有者或admin，同步删除 Meilisearch 索引）
  router.delete('/:id', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const chapter = await prisma.chapter.findUnique({
        where: { id: req.params.id },
        include: { novel: { select: { authorId: true } } },
      });
      if (!chapter) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '章节不存在', 404);

      isOwnerOrAdmin(req, chapter.novel.authorId);

      // 删除 Meilisearch 索引
      try {
        await meilisearch.index(CHAPTERS_INDEX).deleteDocument(chapter.id);
      } catch (e) {
        logger.warn({ chapterId: chapter.id, err: (e as Error).message }, 'Meilisearch 删除索引失败');
      }

      // 更新小说字数
      await prisma.novel.update({
        where: { id: chapter.novelId },
        data: { wordCount: { decrement: chapter.wordCount } },
      });

      // 删除数据库记录
      await prisma.chapter.delete({ where: { id: req.params.id } });

      logger.info({ chapterId: req.params.id, userId: req.user!.userId }, '章节删除成功');

      _res.json({ code: 0, data: null, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/publish — 发布章节
  router.post('/:id/publish', async (req: Request, _res: Response, next: NextFunction) => {
    try {
      requireAuth(req);

      const chapter = await prisma.chapter.findUnique({
        where: { id: req.params.id },
        include: { novel: true },
      });
      if (!chapter) throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, '章节不存在', 404);

      isOwnerOrAdmin(req, chapter.novel.authorId);

      if (chapter.isPublished) {
        throw new AppError(ErrorCode.CHAPTER_NOT_PUBLISHED, '章节已发布', 400);
      }

      const now = new Date();

      // 1. 更新 chapter
      const updated = await prisma.chapter.update({
        where: { id: req.params.id },
        data: { isPublished: true, publishedAt: now },
      });

      // 2. 同步到 Meilisearch
      try {
        await meilisearch.index(CHAPTERS_INDEX).addDocuments([
          {
            id: chapter.id,
            novelId: chapter.novelId,
            novelTitle: chapter.novel.title,
            chapterTitle: chapter.title,
            content: chapter.content,
          },
        ]);
      } catch (e) {
        logger.warn({ chapterId: chapter.id, err: (e as Error).message }, 'Meilisearch 同步失败');
      }

      // 3. 更新小说字数和发布状态
      const novelUpdateData: any = {
        wordCount: { increment: chapter.wordCount },
        updatedAt: now,
      };
      if (!chapter.novel.isPublished) {
        novelUpdateData.isPublished = true;
      }
      await prisma.novel.update({
        where: { id: chapter.novelId },
        data: novelUpdateData,
      });

      logger.info({ chapterId: updated.id, novelId: chapter.novelId, userId: req.user!.userId }, '章节发布成功');

      _res.json({ code: 0, data: updated, message: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
