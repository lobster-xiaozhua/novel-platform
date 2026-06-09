import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    authorApplication: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { createAdminRouter } from '../routes/admin';
import { errorHandler } from '../middleware/errorHandler';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';

function generateToken(role = 'admin') {
  return jwt.sign({ userId: 'admin-1', role }, ACCESS_SECRET, { expiresIn: '15m' });
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // 模拟认证中间件
  app.use('/api/admin', (req: any, _res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, ACCESS_SECRET) as any;
      } catch {}
    }
    next();
  });
  app.use('/api/admin', createAdminRouter());
  app.use(errorHandler);
  return app;
}

const mockApplication = {
  id: 'app-1',
  userId: 'user-1',
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  user: { id: 'user-1', username: 'applicant', email: 'app@test.com', role: 'reader' },
};

describe('GET /api/admin/author-applications', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns paginated author applications', async () => {
    vi.mocked(prisma.authorApplication.findMany).mockResolvedValueOnce([mockApplication] as any);
    vi.mocked(prisma.authorApplication.count).mockResolvedValueOnce(1);

    const res = await request(app)
      .get('/api/admin/author-applications')
      .set('Authorization', `Bearer ${generateToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('filters by status', async () => {
    vi.mocked(prisma.authorApplication.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.authorApplication.count).mockResolvedValueOnce(0);

    const res = await request(app)
      .get('/api/admin/author-applications?status=pending')
      .set('Authorization', `Bearer ${generateToken('admin')}`);

    expect(res.status).toBe(200);
    expect(prisma.authorApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) })
    );
  });

  it('rejects non-admin with 403', async () => {
    const res = await request(app)
      .get('/api/admin/author-applications')
      .set('Authorization', `Bearer ${generateToken('reader')}`);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/admin/author-applications/:id', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('approves application and upgrades user role', async () => {
    vi.mocked(prisma.authorApplication.findUnique).mockResolvedValueOnce({ ...mockApplication });
    vi.mocked(prisma.authorApplication.update).mockResolvedValueOnce({
      ...mockApplication,
      status: 'approved',
      reviewedBy: 'admin-1',
      reviewedAt: new Date(),
    });
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 'user-1',
      username: 'applicant',
      email: 'app@test.com',
      passwordHash: 'hashed',
      avatarUrl: null,
      role: 'author',
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .put('/api/admin/author-applications/app-1')
      .set('Authorization', `Bearer ${generateToken('admin')}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { role: 'author' } })
    );
  });

  it('rejects application without changing user role', async () => {
    vi.mocked(prisma.authorApplication.findUnique).mockResolvedValueOnce({ ...mockApplication });
    vi.mocked(prisma.authorApplication.update).mockResolvedValueOnce({
      ...mockApplication,
      status: 'rejected',
      reviewedBy: 'admin-1',
      reviewedAt: new Date(),
    });

    const res = await request(app)
      .put('/api/admin/author-applications/app-1')
      .set('Authorization', `Bearer ${generateToken('admin')}`)
      .send({ action: 'reject' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent application', async () => {
    vi.mocked(prisma.authorApplication.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/admin/author-applications/nonexistent')
      .set('Authorization', `Bearer ${generateToken('admin')}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/users', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns paginated user list', async () => {
    const mockUsers = [
      { id: 'user-1', username: 'test', email: 't@t.com', role: 'reader', passwordHash: 'h', avatarUrl: null, bio: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers as any);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(1);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${generateToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).not.toHaveProperty('passwordHash');
  });

  it('filters by role', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as any);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);

    const res = await request(app)
      .get('/api/admin/users?role=author')
      .set('Authorization', `Bearer ${generateToken('admin')}`);

    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: 'author' }) })
    );
  });
});
