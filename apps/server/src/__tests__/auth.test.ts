import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock redis
vi.mock('../lib/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
  },
}));

import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { createAuthRouter } from '../routes/auth';
import { errorHandler } from '../middleware/errorHandler';

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', createAuthRouter());
  app.use(errorHandler);
  return app;
}

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed',
  avatarUrl: null,
  role: 'reader' as const,
  bio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  reviewedApplications: [],
};

describe('POST /api/auth/register', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('registers a new user successfully', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.username).toBe('testuser');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate username', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      email: 'other@example.com',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'new@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  it('rejects duplicate email', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...mockUser,
        username: 'other',
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', email: 'not-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40000);
  });
});

describe('POST /api/auth/login', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('logs in successfully', async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 12);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      passwordHash: hashedPassword,
    });
    vi.mocked(redis.setex).mockResolvedValueOnce('OK');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 12);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      passwordHash: hashedPassword,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });

  it('rejects non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nouser', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41001);
  });
});

describe('POST /api/auth/refresh', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('refreshes token successfully', async () => {
    const jwt = await import('jsonwebtoken');
    const refreshToken = jwt.sign(
      { userId: 'user-1', role: 'reader' },
      process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      { expiresIn: '7d' }
    );
    vi.mocked(redis.get).mockResolvedValueOnce(refreshToken);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=invalid-token']);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(41002);
  });
});

describe('POST /api/auth/logout', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('logs out successfully', async () => {
    vi.mocked(redis.del).mockResolvedValueOnce(1);

    const jwt = await import('jsonwebtoken');
    const accessToken = jwt.sign(
      { userId: 'user-1', role: 'reader' },
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`accessToken=${accessToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });
});
