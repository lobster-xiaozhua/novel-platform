# 墨卷 - 在线小说阅读与创作平台

> 万千故事，皆在指尖

## 技术栈

- **前端**: Next.js 14 (App Router) + Tailwind CSS
- **后端**: Express + TypeScript + Prisma
- **数据库**: PostgreSQL 16
- **缓存**: Redis 7
- **搜索**: Meilisearch v1.7
- **部署**: Docker Compose + Nginx

## 快速开始

```bash
./novel.sh          # 智能模式：首次→完整初始化，已配置→一键启动
./novel.sh setup    # 强制完整初始化
./novel.sh start    # 启动开发服务
```

## 配置

所有配置集中在 `config.json`，首次运行时自动生成 `.env`。

## License

MIT
