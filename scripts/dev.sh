#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 开发启动脚本
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

# 项目根目录检测
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "pnpm-workspace.yaml" ]]; then
  fail "未找到 pnpm-workspace.yaml，请在项目根目录执行此脚本"
fi

# ============================================================
# 参数解析
# ============================================================
TARGET="all"

usage() {
  echo -e "${BOLD}用法:${NC} $0 [--web | --server | --all]"
  echo ""
  echo "  --web      仅启动 Web 前端"
  echo "  --server   仅启动 Server 后端"
  echo "  --all      启动所有服务（默认）"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web)    TARGET="web";    shift ;;
    --server) TARGET="server"; shift ;;
    --all)    TARGET="all";    shift ;;
    -h|--help) usage ;;
    *) fail "未知参数: $1\n使用 --help 查看帮助" ;;
  esac
done

# ============================================================
# 检查 .env
# ============================================================
if [[ ! -f ".env" ]]; then
  fail "未找到 .env 文件，请先运行 ./scripts/setup.sh"
fi

# ============================================================
# 检查 Docker 基础设施
# ============================================================
step "检查 Docker 基础设施"

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

check_container() {
  local name="$1"
  docker ps --format '{{.Names}}' | grep -q "^${name}$"
}

INFRA_RUNNING=true
for svc in novel_postgres novel_redis novel_meilisearch; do
  if ! check_container "$svc"; then
    INFRA_RUNNING=false
    break
  fi
done

if [[ "$INFRA_RUNNING" == "false" ]]; then
  warn "基础设施未运行，正在启动..."
  $COMPOSE_CMD up -d postgres redis meilisearch

  # 等待就绪
  info "等待 PostgreSQL 就绪..."
  for i in $(seq 1 30); do
    if docker exec novel_postgres pg_isready -U novel &>/dev/null; then
      break
    fi
    sleep 2
  done

  info "等待 Redis 就绪..."
  for i in $(seq 1 15); do
    if docker exec novel_redis redis-cli ping &>/dev/null; then
      break
    fi
    sleep 2
  done

  info "等待 Meilisearch 就绪..."
  for i in $(seq 1 15); do
    if curl -sf http://localhost:7700/health &>/dev/null; then
      break
    fi
    sleep 2
  done

  success "基础设施已就绪"
else
  info "基础设施已在运行"
fi

# ============================================================
# 优雅退出
# ============================================================
PIDS=()

cleanup() {
  echo ""
  warn "收到退出信号，正在停止服务..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null || true
    fi
  done
  success "开发服务已停止"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ============================================================
# 启动开发服务
# ============================================================
step "启动开发服务 (目标: ${TARGET})"

start_service() {
  local name="$1"
  local cmd="$2"
  info "启动 ${name}..."
  eval "$cmd" &
  PIDS+=($!)
}

case "$TARGET" in
  web)
    start_service "Web" "pnpm dev:web"
    ;;
  server)
    start_service "Server" "pnpm dev:server"
    ;;
  all)
    start_service "Server" "pnpm dev:server"
    start_service "Web" "pnpm dev:web"
    ;;
esac

echo ""
success "开发服务已启动，按 Ctrl+C 停止"
echo -e "  ${CYAN}Web:${NC}     http://localhost:3000"
echo -e "  ${CYAN}Server:${NC}  http://localhost:4000"
echo ""

# 等待所有后台进程
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done
