import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    bookshelf: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    novel: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { createBookshelfRouter } from '../routes/bookshelf';
import { errorHandler } from '../middleware/errorHandler';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';

function generateToken(userId = 'user-1', role = 'reader') {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // 模拟认证：从 Authorization header 解析 user
  app.use('/api/bookshelf', (req: any, _res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, JWT_SECRET) as any;
      } catch {}
    }
    next();
  });
  app.use('/api/bookshelf', createBookshelfRouter());
  app.use(errorHandler);
  return app;
}

const mockBookshelf = {
  id: 'bs-1',
  userId: 'user-1',
  novelId: 'novel-1',
  lastChapterId: null,
  addedAt: new Date(),
  novel: { id: 'novel-1', title: '测试小说', coverUrl: null, status: 'ongoing' },
};

describe('GET /api/bookshelf', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns user bookshelf with novel info', async () => {
    vi.mocked(prisma.bookshelf.findMany).mockResolvedValueOnce([mockBookshelf] as any);

    const res = await request(app)
      .get('/api/bookshelf')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].novel.title).toBe('测试小说');
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/bookshelf');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });
});

describe('POST /api/bookshelf/:novelId', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('adds novel to bookshelf', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce({ id: 'novel-1' } as any);
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.bookshelf.create).mockResolvedValueOnce(mockBookshelf as any);

    const res = await request(app)
      .post('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(prisma.bookshelf.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', novelId: 'novel-1' }),
      })
    );
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/bookshelf/novel-1');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('returns 40002 when novel not found', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/bookshelf/non-existent')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });

  it('returns 42002 when already in bookshelf', async () => {
    vi.mocked(prisma.novel.findUnique).mockResolvedValueOnce({ id: 'novel-1' } as any);
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(mockBookshelf as any);

    const res = await request(app)
      .post('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(42002);
  });
});

describe('DELETE /api/bookshelf/:novelId', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('removes novel from bookshelf', async () => {
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(mockBookshelf as any);
    vi.mocked(prisma.bookshelf.delete).mockResolvedValueOnce(mockBookshelf as any);

    const res = await request(app)
      .delete('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(prisma.bookshelf.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_novelId: { userId: 'user-1', novelId: 'novel-1' } },
      })
    );
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).delete('/api/bookshelf/novel-1');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('returns 40002 when bookshelf record not found', async () => {
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });
});

describe('PUT /api/bookshelf/:novelId', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('updates reading progress', async () => {
    const updated = { ...mockBookshelf, lastChapterId: 'chapter-5' };
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(mockBookshelf as any);
    vi.mocked(prisma.bookshelf.update).mockResolvedValueOnce(updated as any);

    const res = await request(app)
      .put('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ lastChapterId: 'chapter-5' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(prisma.bookshelf.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastChapterId: 'chapter-5' },
      })
    );
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .put('/api/bookshelf/novel-1')
      .send({ lastChapterId: 'chapter-5' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('returns 40002 when bookshelf record not found', async () => {
    vi.mocked(prisma.bookshelf.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ lastChapterId: 'chapter-5' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40002);
  });

  it('rejects missing lastChapterId', async () => {
    const res = await request(app)
      .put('/api/bookshelf/novel-1')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });
});
