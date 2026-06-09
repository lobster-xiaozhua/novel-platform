import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ErrorCode } from '@novel/shared';

// 使用 vi.hoisted 确保 mock 在 vi.mock 工厂中可用
const { mockSearch, mockMultiSearch, mockRedisGet, mockRedisSet } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockMultiSearch: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock('../lib/meilisearch', () => ({
  default: {
    index: vi.fn(() => ({
      search: mockSearch,
    })),
    multiSearch: mockMultiSearch,
  },
  NOVELS_INDEX: 'novels',
  CHAPTERS_INDEX: 'chapters',
}));

vi.mock('../lib/redis', () => ({
  default: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}));

import { createSearchRouter } from '../routes/search';
import { errorHandler } from '../middleware/errorHandler';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', createSearchRouter());
  app.use(errorHandler);
  return app;
}

describe('GET /api/search — 全文搜索', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('搜索小说 (type=novel)', async () => {
    mockSearch.mockResolvedValueOnce({
      hits: [{ id: 'n1', title: '测试小说', authorName: '作者A' }],
      totalHits: 1,
    });

    const res = await request(app).get('/api/search?q=测试&type=novel');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.novels.items).toHaveLength(1);
    expect(res.body.data.novels.total).toBe(1);
    expect(res.body.data.novels.items[0].title).toBe('测试小说');
  });

  it('搜索章节 (type=chapter)，返回高亮片段', async () => {
    mockSearch.mockResolvedValueOnce({
      hits: [
        {
          id: 'c1',
          novelId: 'n1',
          chapterTitle: '第一章',
          _formatted: { content: '这是<em>测试</em>高亮内容' },
        },
      ],
      totalHits: 1,
    });

    const res = await request(app).get('/api/search?q=测试&type=chapter');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.chapters.items).toHaveLength(1);
    expect(res.body.data.chapters.total).toBe(1);
    expect(res.body.data.chapters.items[0]._formatted.content).toContain('<em>测试</em>');
  });

  it('同时搜索小说和章节 (type=all)', async () => {
    mockMultiSearch.mockResolvedValueOnce({
      results: [
        { hits: [{ id: 'n1', title: '测试小说' }], totalHits: 1 },
        { hits: [{ id: 'c1', chapterTitle: '第一章', _formatted: { content: '测试内容' } }], totalHits: 1 },
      ],
    });

    const res = await request(app).get('/api/search?q=测试&type=all');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.novels.items).toHaveLength(1);
    expect(res.body.data.chapters.items).toHaveLength(1);
  });

  it('默认 type=all', async () => {
    mockMultiSearch.mockResolvedValueOnce({
      results: [
        { hits: [], totalHits: 0 },
        { hits: [], totalHits: 0 },
      ],
    });

    const res = await request(app).get('/api/search?q=测试');

    expect(res.status).toBe(200);
    expect(mockMultiSearch).toHaveBeenCalled();
  });

  it('搜索服务不可用时返回 50002', async () => {
    mockMultiSearch.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/search?q=测试');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe(ErrorCode.SEARCH_ERROR);
  });
});

describe('GET /api/search/suggest — 搜索建议', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('缓存命中直接返回', async () => {
    mockRedisGet.mockResolvedValueOnce(
      JSON.stringify([{ title: '测试小说', author: '作者A' }])
    );

    const res = await request(app).get('/api/search/suggest?q=测');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.suggestions).toHaveLength(1);
    expect(res.body.data.suggestions[0].title).toBe('测试小说');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('缓存未命中查 Meilisearch 并写入缓存', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockSearch.mockResolvedValueOnce({
      hits: [
        { id: 'n1', title: '测试小说', authorName: '作者A' },
        { id: 'n2', title: '测试之路', authorName: '作者B' },
      ],
      totalHits: 2,
    });

    const res = await request(app).get('/api/search/suggest?q=测');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.suggestions).toHaveLength(2);
    expect(res.body.data.suggestions[0]).toEqual({ title: '测试小说', author: '作者A' });
    // 验证缓存写入
    expect(mockRedisSet).toHaveBeenCalledWith(
      'suggest:测',
      expect.any(String),
      'EX',
      300
    );
  });

  it('搜索建议服务不可用返回 50002', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockSearch.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/search/suggest?q=测');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe(ErrorCode.SEARCH_ERROR);
  });
});
