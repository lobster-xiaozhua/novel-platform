#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 数据库管理脚本
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}${BOLD}[STEP]${NC}  ${CYAN}$*${NC}"; }
success() { echo -e "${GREEN}${BOLD}[DONE]${NC}  $*"; }
fail()    { error "$@"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "pnpm-workspace.yaml" ]]; then
  fail "未找到 pnpm-workspace.yaml，请在项目根目录执行此脚本"
fi

PRISMA_CMD="pnpm --filter @novel/server exec prisma"

# ============================================================
# 子命令
# ============================================================

cmd_migrate() {
  step "执行数据库迁移"
  $PRISMA_CMD migrate dev
  success "迁移完成"
}

cmd_seed() {
  step "填充种子数据"

  # 检查 seed 脚本是否存在
  SEED_FILE="apps/server/prisma/seed.ts"
  if [[ ! -f "$SEED_FILE" ]]; then
    warn "未找到 seed 脚本 ($SEED_FILE)，正在创建默认 seed 脚本..."
    mkdir -p "$(dirname "$SEED_FILE")"
    cat > "$SEED_FILE" << 'SEED_EOF'
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始填充种子数据...");

  // 创建管理员用户
  const admin = await prisma.user.upsert({
    where: { email: "admin@novel.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@novel.com",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "admin",
      bio: "系统管理员",
    },
  });
  console.log(`  ✓ 管理员: ${admin.username}`);

  // 创建测试作者
  const author = await prisma.user.upsert({
    where: { email: "author@novel.com" },
    update: {},
    create: {
      username: "author",
      email: "author@novel.com",
      passwordHash: await bcrypt.hash("author123", 10),
      role: "author",
      bio: "测试作者",
    },
  });
  console.log(`  ✓ 作者: ${author.username}`);

  // 创建测试读者
  const reader = await prisma.user.upsert({
    where: { email: "reader@novel.com" },
    update: {},
    create: {
      username: "reader",
      email: "reader@novel.com",
      passwordHash: await bcrypt.hash("reader123", 10),
      role: "reader",
      bio: "测试读者",
    },
  });
  console.log(`  ✓ 读者: ${reader.username}`);

  // 创建测试小说
  const novel = await prisma.novel.create({
    data: {
      authorId: author.id,
      title: "测试小说示例",
      description: "这是一本用于测试的小说",
      category: "玄幻",
      tags: ["测试", "示例"],
      status: "ongoing",
      isPublished: true,
    },
  });
  console.log(`  ✓ 小说: ${novel.title}`);

  // 创建测试章节
  await prisma.chapter.create({
    data: {
      novelId: novel.id,
      title: "第一章 开始",
      content: "这是第一章的内容，用于测试阅读功能。",
      wordCount: 20,
      sortOrder: 1,
      isPublished: true,
      publishedAt: new Date(),
    },
  });
  console.log("  ✓ 章节: 第一章");

  console.log("🌱 种子数据填充完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
SEED_EOF

    # 在 server 的 package.json 中添加 prisma seed 配置
    SERVER_PKG="apps/server/package.json"
    if ! grep -q '"seed"' "$SERVER_PKG" 2>/dev/null; then
      info "在 package.json 中添加 prisma seed 配置..."
      node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('$SERVER_PKG', 'utf8'));
        pkg.prisma = pkg.prisma || {};
        pkg.prisma.seed = 'tsx apps/server/prisma/seed.ts';
        fs.writeFileSync('$SERVER_PKG', JSON.stringify(pkg, null, 2) + '\n');
      "
    fi

    success "seed 脚本已创建"
  fi

  $PRISMA_CMD db seed
  success "种子数据填充完成"
}

cmd_reset() {
  echo -e "${RED}${BOLD}⚠️  警告：此操作将删除所有数据并重置数据库！${NC}"
  echo -ne "${YELLOW}确认执行？输入 YES 继续: ${NC}"
  read -r confirm

  if [[ "$confirm" != "YES" ]]; then
    info "操作已取消"
    exit 0
  fi

  step "重置数据库"
  $PRISMA_CMD migrate reset --force
  success "数据库已重置"
}

cmd_studio() {
  step "启动 Prisma Studio"
  info "Prisma Studio 将在浏览器中打开: https://localhost:5555"
  $PRISMA_CMD studio
}

cmd_status() {
  step "检查数据库状态"

  # 检查 PostgreSQL 连接
  info "PostgreSQL 连接状态:"
  if docker exec novel_postgres pg_isready -U novel &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL 可连接"
  else
    echo -e "  ${RED}✗${NC} PostgreSQL 不可连接"
  fi

  # 检查迁移状态
  info "迁移状态:"
  $PRISMA_CMD migrate status

  # 数据库统计
  info "数据统计:"
  docker exec novel_postgres psql -U novel -d novel_platform -t -c "
    SELECT '  用户: ' || COUNT(*) FROM users UNION ALL
    SELECT '  小说: ' || COUNT(*) FROM novels UNION ALL
    SELECT '  章节: ' || COUNT(*) FROM chapters UNION ALL
    SELECT '  书架: ' || COUNT(*) FROM bookshelves;
  " 2>/dev/null || warn "无法获取数据统计"
}

# ============================================================
# 主入口
# ============================================================
usage() {
  echo -e "${BOLD}用法:${NC} $0 <子命令>"
  echo ""
  echo "  migrate  执行数据库迁移 (prisma migrate dev)"
  echo "  seed     填充种子数据 (prisma db seed)"
  echo "  reset    重置数据库（危险，需二次确认）"
  echo "  studio   启动 Prisma Studio 可视化管理"
  echo "  status   查看数据库连接和迁移状态"
  echo "  -h,--help 查看帮助"
  exit 0
}

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  migrate) cmd_migrate ;;
  seed)    cmd_seed ;;
  reset)   cmd_reset ;;
  studio)  cmd_studio ;;
  status)  cmd_status ;;
  -h|--help|"") usage ;;
  *) fail "未知子命令: $COMMAND\n使用 --help 查看帮助" ;;
esac
