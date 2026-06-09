#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 项目初始化脚本
# ============================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# 日志函数
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}${BOLD}[STEP]${NC}  ${CYAN}$*${NC}"; }
success() { echo -e "${GREEN}${BOLD}[DONE]${NC}  $*"; }
fail()    { error "$@"; exit 1; }

# 项目根目录检测
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "pnpm-workspace.yaml" ]]; then
  fail "未找到 pnpm-workspace.yaml，请在项目根目录执行此脚本"
fi

# ============================================================
# 1. 检查系统依赖
# ============================================================
step "检查系统依赖"

check_command() {
  local cmd="$1"
  local version_flag="${2:-"--version"}"
  if ! command -v "$cmd" &>/dev/null; then
    fail "缺少依赖: $cmd 未安装，请先安装后重试"
  fi
  local ver
  ver=$("$cmd" "$version_flag" 2>&1 | head -1)
  info "$cmd: $ver"
}

# Node >= 20
check_command "node"
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node.js 版本需 >= 20，当前: $(node --version)"
fi

check_command "pnpm"
check_command "docker"
check_command "docker-compose" || check_command "docker" "compose version"

success "系统依赖检查通过"

# ============================================================
# 2. 复制 .env 文件
# ============================================================
step "配置环境变量"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    warn "已从 .env.example 创建 .env，请根据实际情况修改配置"
  else
    fail "未找到 .env.example，无法创建 .env"
  fi
else
  info ".env 文件已存在，跳过"
fi

# ============================================================
# 3. 安装依赖
# ============================================================
step "安装项目依赖"

pnpm install --frozen-lockfile 2>/dev/null || pnpm install
success "依赖安装完成"

# ============================================================
# 4. 构建 shared 包
# ============================================================
step "构建 @novel/shared 包"

pnpm --filter @novel/shared build
success "shared 包构建完成"

# ============================================================
# 5. 生成 Prisma 客户端
# ============================================================
step "生成 Prisma 客户端"

pnpm --filter @novel/server exec prisma generate
success "Prisma 客户端生成完成"

# ============================================================
# 6. 启动 Docker 基础设施
# ============================================================
step "启动 Docker 基础设施 (PostgreSQL + Redis + Meilisearch)"

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD up -d postgres redis meilisearch
success "Docker 容器已启动"

# ============================================================
# 7. 等待服务就绪
# ============================================================
step "等待服务就绪"

wait_for_service() {
  local name="$1"
  local cmd="$2"
  local max_retries=30
  local retry=0

  while $cmd &>/dev/null; [[ $? -ne 0 ]]; do
    retry=$((retry + 1))
    if [[ $retry -ge $max_retries ]]; then
      fail "$name 启动超时（${max_retries}次重试后仍不可用）"
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  info "$name 已就绪"
}

info "等待 PostgreSQL..."
wait_for_service "PostgreSQL" "docker exec novel_postgres pg_isready -U novel"

info "等待 Redis..."
wait_for_service "Redis" "docker exec novel_redis redis-cli ping"

info "等待 Meilisearch..."
wait_for_service "Meilisearch" "curl -sf http://localhost:7700/health"

success "所有基础设施服务已就绪"

# ============================================================
# 8. 执行数据库迁移
# ============================================================
step "执行数据库迁移"

pnpm --filter @novel/server exec prisma migrate deploy
success "数据库迁移完成"

# ============================================================
# 9. 初始化 Meilisearch 索引
# ============================================================
step "初始化 Meilisearch 索引"

MEILI_KEY=$(grep MEILI_MASTER_KEY .env | cut -d'=' -f2)

# 创建 novels 索引
curl -sf -X POST "http://localhost:7700/indexes" \
  -H "Authorization: Bearer $MEILI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uid":"novels","primaryKey":"id"}' &>/dev/null && info "novels 索引创建成功" || warn "novels 索引可能已存在"

# 创建 chapters 索引
curl -sf -X POST "http://localhost:7700/indexes" \
  -H "Authorization: Bearer $MEILI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uid":"chapters","primaryKey":"id"}' &>/dev/null && info "chapters 索引创建成功" || warn "chapters 索引可能已存在"

success "Meilisearch 索引初始化完成"

# ============================================================
# 完成
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  🎉 项目初始化完成！${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
echo -e "  下一步操作："
echo -e "  ${CYAN}1.${NC} 修改 ${BOLD}.env${NC} 中的配置（如 JWT 密钥等）"
echo -e "  ${CYAN}2.${NC} 运行 ${BOLD}./scripts/dev.sh${NC} 启动开发服务"
echo -e "  ${CYAN}3.${NC} 运行 ${BOLD}./scripts/db.sh seed${NC} 填充测试数据"
echo ""
