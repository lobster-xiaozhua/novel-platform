import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import meilisearch, { NOVELS_INDEX, CHAPTERS_INDEX } from '../lib/meilisearch';
import redis from '../lib/redis';
import { AppError } from '../middleware/errorHandler';
import { ErrorCode, searchSchema } from '@novel/shared';
import pino from 'pino';

const logger = pino();

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

export function createSearchRouter() {
  const router = Router();

  // GET / — 全文搜索
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, type, page, limit } = validate(searchSchema, req.query);
      const offset = (page - 1) * limit;

      if (type === 'all') {
        const results = await meilisearch.multiSearch({
          queries: [
            { indexUid: NOVELS_INDEX, q, limit, offset },
            { indexUid: CHAPTERS_INDEX, q, limit, offset, attributesToCrop: ['content'], cropLength: 200, attributesToHighlight: ['content'] },
          ],
        });

        const novelsResult = results.results[0] as any;
        const chaptersResult = results.results[1] as any;

        res.json({
          code: 0,
          data: {
            novels: { items: novelsResult.hits, total: novelsResult.totalHits ?? novelsResult.estimatedTotalHits ?? 0 },
            chapters: { items: chaptersResult.hits, total: chaptersResult.totalHits ?? chaptersResult.estimatedTotalHits ?? 0 },
          },
          message: 'ok',
        });
      } else {
        const indexUid = type === 'novel' ? NOVELS_INDEX : CHAPTERS_INDEX;
        const searchOptions = type === 'chapter'
          ? { limit, offset, attributesToCrop: ['content'], cropLength: 200, attributesToHighlight: ['content'] }
          : { limit, offset };

        const result = await meilisearch.index(indexUid).search(q, searchOptions) as any;
        const key = type === 'novel' ? 'novels' : 'chapters';

        res.json({
          code: 0,
          data: {
            [key]: { items: result.hits, total: result.totalHits ?? result.estimatedTotalHits ?? 0 },
          },
          message: 'ok',
        });
      }
    } catch (err) {
      if (err instanceof AppError) return next(err);
      logger.error({ err: (err as Error).message }, '搜索服务异常');
      next(new AppError(ErrorCode.SEARCH_ERROR, '搜索服务不可用', 503));
    }
  });

  // GET /suggest — 搜索建议
  router.get('/suggest', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query.q as string;
      if (!q || q.length < 1) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'q: 搜索关键词至少1个字符', 400);
      }

      // 先查 Redis 缓存
      const cacheKey = `suggest:${q}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          code: 0,
          data: { suggestions: JSON.parse(cached) },
          message: 'ok',
        });
      }

      // 查 Meilisearch
      const result = await meilisearch.index(NOVELS_INDEX).search(q, {
        limit: 8,
        attributesToRetrieve: ['title', 'authorName'],
      });

      const suggestions = result.hits.map((hit: any) => ({
        title: hit.title,
        author: hit.authorName,
      }));

      // 缓存 5 分钟
      await redis.set(cacheKey, JSON.stringify(suggestions), 'EX', 300);

      res.json({
        code: 0,
        data: { suggestions },
        message: 'ok',
      });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      logger.error({ err: (err as Error).message }, '搜索建议服务异常');
      next(new AppError(ErrorCode.SEARCH_ERROR, '搜索服务不可用', 503));
    }
  });

  return router;
}
