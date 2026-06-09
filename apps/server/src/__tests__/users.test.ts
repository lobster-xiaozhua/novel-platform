import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authorApplication: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';
import { createUserRouter } from '../routes/users';
import { errorHandler } from '../middleware/errorHandler';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';

function generateToken(role = 'reader') {
  return jwt.sign({ userId: 'user-1', role }, ACCESS_SECRET, { expiresIn: '15m' });
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  // 模拟认证中间件
  app.use('/api/users', (req: any, _res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, ACCESS_SECRET) as any;
      } catch {}
    }
    next();
  });
  app.use('/api/users', createUserRouter());
  app.use(errorHandler);
  return app;
}

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed',
  avatarUrl: null,
  role: 'reader',
  bio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GET /api/users/me', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns current user info without passwordHash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${generateToken('reader')}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.username).toBe('testuser');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/users/me', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('updates username and bio', async () => {
    const updated = { ...mockUser, username: 'newname', bio: 'hello' };
    vi.mocked(prisma.user.update).mockResolvedValueOnce(updated);

    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${generateToken('reader')}`)
      .send({ username: 'newname', bio: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.username).toBe('newname');
    expect(res.body.data.bio).toBe('hello');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${generateToken('reader')}`)
      .send({ username: 'ab' }); // min 3 chars

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });
});

describe('POST /api/users/apply-author', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('applies for author as reader', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser });
    vi.mocked(prisma.authorApplication.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.authorApplication.create).mockResolvedValueOnce({
      id: 'app-1',
      userId: 'user-1',
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/users/apply-author')
      .set('Authorization', `Bearer ${generateToken('reader')}`);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects duplicate pending application with 42003', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser });
    vi.mocked(prisma.authorApplication.findFirst).mockResolvedValueOnce({
      id: 'app-1',
      userId: 'user-1',
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/users/apply-author')
      .set('Authorization', `Bearer ${generateToken('reader')}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(42003);
  });

  it('rejects non-reader role', async () => {
    const res = await request(app)
      .post('/api/users/apply-author')
      .set('Authorization', `Bearer ${generateToken('author')}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/users/me/avatar', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 501 not implemented', async () => {
    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${generateToken('reader')}`);

    expect(res.status).toBe(501);
  });
});
