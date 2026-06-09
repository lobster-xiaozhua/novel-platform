#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — Docker 管理脚本
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
# 子命令
# ============================================================

cmd_start() {
  local target="${1:-infra}"

  case "$target" in
    infra|infrastructure)
      step "启动基础设施 (PostgreSQL + Redis + Meilisearch)"
      $COMPOSE_CMD up -d postgres redis meilisearch
      success "基础设施已启动"
      ;;
    all)
      step "启动所有服务"
      $COMPOSE_CMD up -d
      success "所有服务已启动"
      ;;
    *)
      step "启动服务: $target"
      $COMPOSE_CMD up -d "$target"
      success "服务 $target 已启动"
      ;;
  esac
}

cmd_stop() {
  local target="${1:-all}"

  case "$target" in
    all)
      step "停止所有服务"
      $COMPOSE_CMD down
      success "所有服务已停止"
      ;;
    *)
      step "停止服务: $target"
      $COMPOSE_CMD stop "$target"
      success "服务 $target 已停止"
      ;;
  esac
}

cmd_restart() {
  local target="${1:-all}"

  case "$target" in
    all)
      step "重启所有服务"
      $COMPOSE_CMD down
      $COMPOSE_CMD up -d
      success "所有服务已重启"
      ;;
    infra|infrastructure)
      step "重启基础设施"
      $COMPOSE_CMD restart postgres redis meilisearch
      success "基础设施已重启"
      ;;
    *)
      step "重启服务: $target"
      $COMPOSE_CMD restart "$target"
      success "服务 $target 已重启"
      ;;
  esac
}

cmd_status() {
  step "服务状态"

  if ! docker ps &>/dev/null; then
    fail "Docker 未运行，请先启动 Docker"
  fi

  echo ""
  # 检查各服务状态
  SERVICES=("novel_postgres" "novel_redis" "novel_meilisearch" "novel_server" "novel_web" "novel_nginx")

  for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
      local uptime
      uptime=$(docker inspect --format='{{.State.StartedAt}}' "$svc" 2>/dev/null | cut -d'.' -f1 || echo "unknown")
      local ports
      ports=$(docker port "$svc" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "none")
      echo -e "  ${GREEN}✓${NC} ${BOLD}${svc}${NC}  运行中  端口: ${ports}"
    else
      echo -e "  ${RED}✗${NC} ${BOLD}${svc}${NC}  已停止"
    fi
  done

  echo ""
  info "Docker Compose 详情:"
  $COMPOSE_CMD ps 2>/dev/null || true
}

cmd_logs() {
  local target="${1:-}"
  local lines="${2:-100}"

  if [[ -n "$target" ]]; then
    step "查看 ${target} 日志 (最近 ${lines} 行)"
    $COMPOSE_CMD logs --tail="$lines" -f "$target"
  else
    step "查看所有日志 (最近 ${lines} 行)"
    $COMPOSE_CMD logs --tail="$lines" -f
  fi
}

cmd_clean() {
  echo -e "${RED}${BOLD}⚠️  警告：此操作将删除所有 Docker 数据（卷、镜像、容器）！${NC}"
  echo -e "${YELLOW}这将清除数据库数据、Redis 缓存、Meilisearch 索引等所有持久化数据${NC}"
  echo -ne "${YELLOW}确认执行？输入 YES 继续: ${NC}"
  read -r confirm

  if [[ "$confirm" != "YES" ]]; then
    info "操作已取消"
    exit 0
  fi

  step "停止并删除所有容器"
  $COMPOSE_CMD down -v --remove-orphans
  success "容器和卷已删除"

  step "清理项目相关镜像"
  docker image prune -f 2>/dev/null || true
  success "镜像已清理"

  info "Docker 资源使用情况:"
  docker system df 2>/dev/null || true
}

# ============================================================
# 主入口
# ============================================================
usage() {
  echo -e "${BOLD}用法:${NC} $0 <子命令> [参数]"
  echo ""
  echo -e "  start [infra|all|<服务名>]   启动服务（默认: infra）"
  echo -e "  stop [all|<服务名>]          停止服务（默认: all）"
  echo -e "  restart [all|infra|<服务名>] 重启服务（默认: all）"
  echo "  status                       查看服务状态"
  echo "  logs [<服务名>] [行数]       查看日志（默认: 最近 100 行）"
  echo "  clean                        清理 Docker 资源（危险，需二次确认）"
  echo "  -h,--help                    查看帮助"
  exit 0
}

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  start)   cmd_start "$@" ;;
  stop)    cmd_stop "$@" ;;
  restart) cmd_restart "$@" ;;
  status)  cmd_status ;;
  logs)    cmd_logs "$@" ;;
  clean)   cmd_clean ;;
  -h|--help|"") usage ;;
  *) fail "未知子命令: $COMMAND\n使用 --help 查看帮助" ;;
esac
