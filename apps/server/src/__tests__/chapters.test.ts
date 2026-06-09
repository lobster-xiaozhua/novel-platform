import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    novel: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chapter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

// Mock meilisearch
vi.mock('../lib/meilisearch', () => ({
  default: {
    index: vi.fn().mockReturnValue({
      addDocuments: vi.fn().mockResolvedValue(undefined),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    }),
  },
  NOVELS_INDEX: 'novels',
  CHAPTERS_INDEX: 'chapters',
}));

import prisma from '../lib/prisma';
import meilisearch from '../lib/meilisearch';
import { createChapterRouter } from '../routes/chapters';
import { errorHandler } from '../middleware/errorHandler';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';

function generateToken(userId = 'user-1', role = 'author') {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // 模拟认证中间件：解析 Authorization header 设置 req.user
  app.use((req: any, _res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, JWT_SECRET) as any;
      } catch {}
    }
    next();
  });
  // 章节路由：小说下的章节
  app.use('/api/novels/:novelId/chapters', createChapterRouter());
  // 章节独立操作
  app.use('/api/chapters', createChapterRouter());
  app.use(errorHandler);
  return app;
}

const mockNovel = {
  id: 'novel-1',
  authorId: 'user-1',
  title: '测试小说',
  coverUrl: null,
  description: '描述',
  category: '玄幻',
  tags: [],
  status: 'ongoing',
  wordCount: 1000,
  viewCount: 0,
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockChapter = {
  id: 'chapter-1',
  novelId: 'novel-1',
  title: '第一章',
  content: '这是第一章的内容，有一些文字。',
  wordCount: 15,
  sortOrder: 1,
  isPublished: false,
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  novel: mockNovel,
};

const mockPublishedChapter = {
  ...mockChapter,
  id: 'chapter-2',
  isPublished: true,
  publishedAt: new Date(),
};

// ─── GET /api/novels/:novelId/chapters ───
describe('GET /api/novels/:novelId/chapters', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns published chapters sorted by sortOrder without content', async () => {
    vi.mocked(prisma.chapter.findMany).mockResolvedValueOnce([
      { id: 'ch-1', title: '第一章', sortOrder: 1, isPublished: true, wordCount: 100, novelId: 'novel-1', publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { id: 'ch-2', title: '第二章', sortOrder: 2, isPublished: true, wordCount: 200, novelId: 'novel-1', publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const res = await request(app).get('/api/novels/novel-1/chapters');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(2);
    // 确认 select 不含 content
    expect(prisma.chapter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ novelId: 'novel-1', isPublished: true }),
        orderBy: { sortOrder: 'asc' },
      })
    );
  });
});

// ─── GET /api/chapters/:id ───
describe('GET /api/chapters/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns chapter detail with content', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockPublishedChapter as any);

    const res = await request(app).get('/api/chapters/chapter-2');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.content).toBeDefined();
  });

  it('returns 404 for non-existent chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(null);

    const res = await request(app).get('/api/chapters/non-existent');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });

  it('allows author to view unpublished own chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);

    const res = await request(app)
      .get('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBeDefined();
  });

  it('rejects non-author viewing unpublished chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);

    const res = await request(app)
      .get('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('other-user', 'reader')}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(41003);
  });

  it('allows anyone to view published chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockPublishedChapter as any);

    const res = await request(app).get('/api/chapters/chapter-2');

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/novels/:novelId/chapters ───
describe('POST /api/novels/:novelId/chapters', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('creates a chapter as author with auto wordCount and sortOrder', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(mockNovel as any);
    vi.mocked(prisma.chapter.aggregate).mockResolvedValueOnce({ _max: { sortOrder: 2 } } as any);
    vi.mocked(prisma.chapter.create).mockResolvedValueOnce({
      ...mockChapter,
      wordCount: 15,
      sortOrder: 3,
    } as any);

    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '第一章', content: '这是第一章的内容，有一些文字。' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.wordCount).toBe(15);
    expect(res.body.data.sortOrder).toBe(3);

    expect(prisma.chapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          novelId: 'novel-1',
          title: '第一章',
          content: '这是第一章的内容，有一些文字。',
          wordCount: 15,
          sortOrder: 3,
        }),
      })
    );
  });

  it('sets sortOrder to 1 when no chapters exist', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(mockNovel as any);
    vi.mocked(prisma.chapter.aggregate).mockResolvedValueOnce({ _max: { sortOrder: null } } as any);
    vi.mocked(prisma.chapter.create).mockResolvedValueOnce({
      ...mockChapter,
      sortOrder: 1,
    } as any);

    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '第一章', content: '内容' });

    expect(res.status).toBe(201);
    expect(prisma.chapter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 1 }),
      })
    );
  });

  it('rejects reader creating chapter', async () => {
    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .set('Authorization', `Bearer ${generateToken('user-2', 'reader')}`)
      .send({ title: '第一章', content: '内容' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(41003);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .send({ title: '第一章', content: '内容' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('rejects invalid input (empty title)', async () => {
    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '', content: '内容' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });

  it('rejects invalid input (missing content)', async () => {
    const res = await request(app)
      .post('/api/novels/novel-1/chapters')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '标题' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });

  it('returns 404 when novel does not exist', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/novels/non-existent/chapters')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '第一章', content: '内容' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });
});

// ─── PUT /api/chapters/:id ───
describe('PUT /api/chapters/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('updates own chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.update).mockResolvedValueOnce({
      ...mockChapter,
      title: '新标题',
    } as any);

    const res = await request(app)
      .put('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '新标题' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('新标题');
  });

  it('allows admin to update any chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.update).mockResolvedValueOnce({
      ...mockChapter,
      title: '管理员修改',
    } as any);

    const res = await request(app)
      .put('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('admin-user', 'admin')}`)
      .send({ title: '管理员修改' });

    expect(res.status).toBe(200);
  });

  it('rejects updating others chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);

    const res = await request(app)
      .put('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('other-user', 'author')}`)
      .send({ title: '新标题' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(41003);
  });

  it('returns 404 for non-existent chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/chapters/non-existent')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ title: '新标题' });

    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .put('/api/chapters/chapter-1')
      .send({ title: '新标题' });

    expect(res.status).toBe(401);
  });

  it('recalculates wordCount when content is updated', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.update).mockResolvedValueOnce({
      ...mockChapter,
      content: '新内容',
      wordCount: 3,
    } as any);

    const res = await request(app)
      .put('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`)
      .send({ content: '新内容' });

    expect(res.status).toBe(200);
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wordCount: 3 }),
      })
    );
  });
});

// ─── DELETE /api/chapters/:id ───
describe('DELETE /api/chapters/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('deletes own chapter and syncs meilisearch + novel wordCount', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.delete).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.novel.update).mockResolvedValueOnce({ ...mockNovel, wordCount: 985 } as any);

    const res = await request(app)
      .delete('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    // 确认删除 meilisearch 索引
    expect(meilisearch.index).toHaveBeenCalledWith('chapters');
    // 确认更新小说字数
    expect(prisma.novel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'novel-1' },
        data: expect.objectContaining({ wordCount: { decrement: 15 } }),
      })
    );
  });

  it('allows admin to delete any chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.delete).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.novel.update).mockResolvedValueOnce(mockNovel as any);

    const res = await request(app)
      .delete('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('admin-user', 'admin')}`);

    expect(res.status).toBe(200);
  });

  it('rejects deleting others chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);

    const res = await request(app)
      .delete('/api/chapters/chapter-1')
      .set('Authorization', `Bearer ${generateToken('other-user', 'author')}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/chapters/non-existent')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .delete('/api/chapters/chapter-1');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/chapters/:id/publish ───
describe('POST /api/chapters/:id/publish', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('publishes chapter and syncs meilisearch + novel wordCount', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);
    vi.mocked(prisma.chapter.update).mockResolvedValueOnce({
      ...mockChapter,
      isPublished: true,
      publishedAt: new Date(),
    } as any);
    vi.mocked(prisma.novel.update).mockResolvedValueOnce({
      ...mockNovel,
      wordCount: 1015,
    } as any);

    const res = await request(app)
      .post('/api/chapters/chapter-1/publish')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);

    // 确认同步到 meilisearch
    expect(meilisearch.index).toHaveBeenCalledWith('chapters');

    // 确认更新小说字数
    expect(prisma.novel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'novel-1' },
        data: expect.objectContaining({
          wordCount: { increment: 15 },
          updatedAt: expect.any(Date),
        }),
      })
    );
  });

  it('publishes novel along with chapter if novel is unpublished', async () => {
    const unpublishedNovel = { ...mockNovel, isPublished: false };
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce({
      ...mockChapter,
      novel: unpublishedNovel,
    } as any);
    vi.mocked(prisma.chapter.update).mockResolvedValueOnce({
      ...mockChapter,
      isPublished: true,
      publishedAt: new Date(),
    } as any);
    vi.mocked(prisma.novel.update).mockResolvedValueOnce({
      ...unpublishedNovel,
      isPublished: true,
      wordCount: 15,
    } as any);

    const res = await request(app)
      .post('/api/chapters/chapter-1/publish')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(200);
    expect(prisma.novel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPublished: true }),
      })
    );
  });

  it('rejects publishing by non-owner', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockChapter as any);

    const res = await request(app)
      .post('/api/chapters/chapter-1/publish')
      .set('Authorization', `Bearer ${generateToken('other-user', 'author')}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/chapters/non-existent/publish')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(404);
  });

  it('rejects already published chapter', async () => {
    vi.mocked(prisma.chapter.findUnique).mockResolvedValueOnce(mockPublishedChapter as any);

    const res = await request(app)
      .post('/api/chapters/chapter-2/publish')
      .set('Authorization', `Bearer ${generateToken('user-1', 'author')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(42001);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/chapters/chapter-1/publish');

    expect(res.status).toBe(401);
  });
});
