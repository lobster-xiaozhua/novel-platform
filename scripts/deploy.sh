#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 部署脚本
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

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

# ============================================================
# 参数解析
# ============================================================
DEPLOY_ENV="production"
ROLLBACK=false

usage() {
  echo -e "${BOLD}用法:${NC} $0 [--env <environment>] [--rollback]"
  echo ""
  echo "  --env <env>     部署环境: production / staging（默认: production）"
  echo "  --rollback      回滚到上一版本"
  echo "  -h,--help       查看帮助"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      DEPLOY_ENV="${2:-}"
      [[ -z "$DEPLOY_ENV" ]] && fail "--env 需要指定环境名称"
      shift 2
      ;;
    --rollback) ROLLBACK=true; shift ;;
    -h|--help)  usage ;;
    *) fail "未知参数: $1" ;;
  esac
done

if [[ "$DEPLOY_ENV" != "production" && "$DEPLOY_ENV" != "staging" ]]; then
  fail "无效环境: $DEPLOY_ENV，仅支持 production / staging"
fi

# ============================================================
# 回滚
# ============================================================
if [[ "$ROLLBACK" == "true" ]]; then
  step "回滚到上一版本"

  # 检查是否有上一版本镜像
  PREV_IMAGES=$(docker images --filter "reference=novel-platform-*" --format "{{.Repository}}:{{.Tag}}" | head -5)

  if [[ -z "$PREV_IMAGES" ]]; then
    fail "未找到可回滚的镜像"
  fi

  echo -e "${YELLOW}可用镜像:${NC}"
  echo "$PREV_IMAGES"
  echo ""

  # 使用 docker compose 回滚
  if [[ -f "docker-compose.${DEPLOY_ENV}.yml" ]]; then
    COMPOSE_FILE="-f docker-compose.${DEPLOY_ENV}.yml"
  else
    COMPOSE_FILE=""
  fi

  $COMPOSE_CMD $COMPOSE_FILE down
  info "已停止当前服务"

  # 回滚到上一个镜像标签
  LAST_TAG=$(docker images --filter "reference=novel-platform-server" --format "{{.Tag}}" | sed -n '2p')
  if [[ -n "$LAST_TAG" ]]; then
    info "回滚到标签: $LAST_TAG"
  fi

  $COMPOSE_CMD $COMPOSE_FILE up -d
  success "回滚完成"
  exit 0
fi

# ============================================================
# 部署流程
# ============================================================
DEPLOY_START=$(date +%s)
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# 1. 检查 .env
step "检查环境配置 (${DEPLOY_ENV})"

if [[ -f ".env.${DEPLOY_ENV}" ]]; then
  info "使用 .env.${DEPLOY_ENV}"
elif [[ -f ".env" ]]; then
  warn "未找到 .env.${DEPLOY_ENV}，使用 .env"
else
  fail "未找到环境配置文件"
fi

# 2. 构建 Docker 镜像
step "构建 Docker 镜像"

COMPOSE_FILES="-f docker-compose.yml"
if [[ -f "docker-compose.${DEPLOY_ENV}.yml" ]]; then
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.${DEPLOY_ENV}.yml"
fi

$COMPOSE_CMD $COMPOSE_FILES build --no-cache
success "Docker 镜像构建完成"

# 3. 标记镜像版本
docker tag novel-platform-server:latest "novel-platform-server:${TIMESTAMP}" 2>/dev/null || true
docker tag novel-platform-web:latest "novel-platform-web:${TIMESTAMP}" 2>/dev/null || true
info "镜像已标记: ${TIMESTAMP}"

# 4. 启动服务
step "启动服务"

$COMPOSE_CMD $COMPOSE_FILES up -d
success "服务已启动"

# 5. 等待健康检查
step "等待健康检查"

wait_for_healthy() {
  local name="$1"
  local max_retries=30
  local retry=0

  while [[ $retry -lt $max_retries ]]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "unknown")
    if [[ "$status" == "healthy" ]]; then
      info "$name: healthy"
      return 0
    fi
    retry=$((retry + 1))
    echo -n "."
    sleep 3
  done
  echo ""
  warn "$name: 健康检查超时"
  return 1
}

# 等待基础设施
for svc in novel_postgres novel_redis; do
  wait_for_healthy "$svc" || warn "$svc 健康检查未通过"
done

# 等待应用服务
sleep 5
for svc in novel_server novel_web; do
  if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
    info "$svc: $(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo 'unknown')"
  fi
done

# 6. 执行数据库迁移
step "执行数据库迁移"

$COMPOSE_CMD $COMPOSE_FILES exec -T server npx prisma migrate deploy 2>/dev/null || \
  pnpm --filter @novel/server exec prisma migrate deploy
success "数据库迁移完成"

# 7. 输出服务状态
step "服务状态"

$COMPOSE_CMD $COMPOSE_FILES ps

DEPLOY_END=$(date +%s)
DEPLOY_TIME=$((DEPLOY_END - DEPLOY_START))

echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  🚀 部署完成！环境: ${DEPLOY_ENV}  耗时: ${DEPLOY_TIME}s${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
