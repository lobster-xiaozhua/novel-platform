import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import { authRouter } from './routes/auth';
import { createNovelRouter } from './routes/novels';
import { createChapterRouter } from './routes/chapters';
import { createBookshelfRouter } from './routes/bookshelf';
import { createSearchRouter } from './routes/search';
import { createUserRouter } from './routes/users';
import { createAdminRouter } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimit';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

// 限流
app.use('/api/auth/login', rateLimiter('login'));
app.use('/api/search', rateLimiter('search'));
app.use('/api/', rateLimiter('api'));

// 路由
app.use('/api/auth', authRouter);
app.use('/api/novels', createNovelRouter());
app.use('/api/novels/:novelId/chapters', createChapterRouter());
app.use('/api/chapters', createChapterRouter());
app.use('/api/bookshelf', createBookshelfRouter());
app.use('/api/search', createSearchRouter());
app.use('/api/users', createUserRouter());
app.use('/api/admin', createAdminRouter());

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, data: { status: 'ok' }, message: 'ok' });
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export { app, logger };
