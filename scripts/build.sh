#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 构建脚本
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

# ============================================================
# 参数解析
# ============================================================
CLEAN=false

usage() {
  echo -e "${BOLD}用法:${NC} $0 [--clean]"
  echo ""
  echo "  --clean   清理构建产物后重新构建"
  echo "  -h,--help 查看帮助"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) CLEAN=true; shift ;;
    -h|--help) usage ;;
    *) fail "未知参数: $1" ;;
  esac
done

# ============================================================
# 清理构建产物
# ============================================================
if [[ "$CLEAN" == "true" ]]; then
  step "清理构建产物"

  rm -rf packages/shared/dist
  rm -rf apps/server/dist
  rm -rf apps/web/.next

  success "构建产物已清理"
fi

# ============================================================
# 按顺序构建
# ============================================================
BUILD_START=$(date +%s)

# 1. shared
step "构建 @novel/shared"
if ! pnpm --filter @novel/shared build; then
  fail "shared 包构建失败，请检查错误信息"
fi
success "shared 包构建完成"

# 2. server
step "构建 @novel/server"
if ! pnpm --filter @novel/server build; then
  fail "server 构建失败，请检查错误信息"
fi
success "server 构建完成"

# 3. web
step "构建 @novel/web"
if ! pnpm --filter @novel/web build; then
  fail "web 构建失败，请检查错误信息"
fi
success "web 构建完成"

# ============================================================
# 构建汇总
# ============================================================
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo ""
echo -e "${GREEN}${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}  ✅ 构建完成！耗时 ${BUILD_TIME}s${NC}"
echo -e "${GREEN}${BOLD}========================================${NC}"
echo ""
echo -e "  构建顺序: shared → server → web"
echo -e "  产物路径:"
echo -e "    ${CYAN}packages/shared/dist${NC}"
echo -e "    ${CYAN}apps/server/dist${NC}"
echo -e "    ${CYAN}apps/web/.next${NC}"
echo ""
