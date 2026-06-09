import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    novel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { createNovelRouter } from '../routes/novels';
import { errorHandler } from '../middleware/errorHandler';

// 辅助：生成有效 JWT
function generateToken(role = 'author') {
  return jwt.sign(
    { userId: 'user-1', role },
    process.env.JWT_ACCESS_SECRET || 'test-access-secret',
    { expiresIn: '15m' }
  );
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // 模拟认证中间件
  app.use('/api/novels', (req: any, _res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'test-access-secret') as any;
      } catch {}
    }
    next();
  });
  app.use('/api/novels', createNovelRouter());
  app.use(errorHandler);
  return app;
}

const mockNovel = {
  id: 'novel-1',
  authorId: 'user-1',
  title: '测试小说',
  coverUrl: null,
  description: '这是一个测试小说',
  category: '玄幻',
  tags: ['修仙'],
  status: 'ongoing',
  wordCount: 0,
  viewCount: 0,
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GET /api/novels', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns paginated novel list', async () => {
    vi.mocked(prisma.novel.findMany).mockResolvedValueOnce([mockNovel] as any);
    vi.mocked(prisma.novel.count).mockResolvedValueOnce(1);

    const res = await request(app).get('/api/novels?page=1&limit=20');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('filters by category', async () => {
    vi.mocked(prisma.novel.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.novel.count).mockResolvedValueOnce(0);

    const res = await request(app).get('/api/novels?category=玄幻');

    expect(res.status).toBe(200);
    expect(prisma.novel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: '玄幻' }),
      })
    );
  });
});

describe('GET /api/novels/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns novel detail', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce({
      ...mockNovel,
      author: { username: 'author1', avatarUrl: null },
    } as any);

    const res = await request(app).get('/api/novels/novel-1');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.title).toBe('测试小说');
  });

  it('returns 404 for non-existent novel', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(null);

    const res = await request(app).get('/api/novels/non-existent');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });
});

describe('POST /api/novels', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('creates a novel as author', async () => {
    vi.mocked(prisma.novel.create).mockResolvedValueOnce(mockNovel as any);

    const res = await request(app)
      .post('/api/novels')
      .set('Authorization', `Bearer ${generateToken('author')}`)
      .send({ title: '测试小说', description: '描述', category: '玄幻', tags: ['修仙'] });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.title).toBe('测试小说');
  });

  it('rejects reader creating novel', async () => {
    const res = await request(app)
      .post('/api/novels')
      .set('Authorization', `Bearer ${generateToken('reader')}`)
      .send({ title: '测试小说' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(41003);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/novels')
      .send({ title: '测试小说' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/novels')
      .set('Authorization', `Bearer ${generateToken('author')}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });
});

describe('PUT /api/novels/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('updates own novel', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(mockNovel as any);
    vi.mocked(prisma.novel.update).mockResolvedValueOnce({ ...mockNovel, title: '新标题' } as any);

    const res = await request(app)
      .put('/api/novels/novel-1')
      .set('Authorization', `Bearer ${generateToken('author')}`)
      .send({ title: '新标题' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('新标题');
  });

  it('rejects updating others novel', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce({ ...mockNovel, authorId: 'other-user' } as any);

    const res = await request(app)
      .put('/api/novels/novel-1')
      .set('Authorization', `Bearer ${generateToken('author')}`)
      .send({ title: '新标题' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(41003);
  });
});

describe('DELETE /api/novels/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('deletes own novel', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(mockNovel as any);
    vi.mocked(prisma.novel.delete).mockResolvedValueOnce(mockNovel as any);

    const res = await request(app)
      .delete('/api/novels/novel-1')
      .set('Authorization', `Bearer ${generateToken('author')}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });
});
