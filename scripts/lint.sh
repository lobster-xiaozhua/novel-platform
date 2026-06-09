#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 代码检查脚本
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
# 检查结果追踪
# ============================================================
PASS_COUNT=0
FAIL_COUNT=0
FAILED_CHECKS=()

run_check() {
  local name="$1"
  local cmd="$2"
  local fix_hint="$3"

  step "${name}"
  if eval "$cmd"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    success "${name} 通过"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_CHECKS+=("$name")
    error "${name} 失败"
    if [[ -n "$fix_hint" ]]; then
      echo -e "  ${YELLOW}修复提示: ${fix_hint}${NC}"
    fi
  fi
}

# ============================================================
# 执行检查
# ============================================================
LINT_START=$(date +%s)

# 1. TypeScript 类型检查
run_check "TypeScript 类型检查 (shared)" \
  "pnpm --filter @novel/shared exec tsc --noEmit" \
  "检查 packages/shared 下的 TypeScript 类型错误"

run_check "TypeScript 类型检查 (server)" \
  "pnpm --filter @novel/server exec tsc --noEmit" \
  "检查 apps/server 下的 TypeScript 类型错误"

run_check "TypeScript 类型检查 (web)" \
  "pnpm --filter @novel/web exec tsc --noEmit" \
  "检查 apps/web 下的 TypeScript 类型错误"

# 2. ESLint
run_check "ESLint (web)" \
  "pnpm --filter @novel/web run lint" \
  "运行 pnpm --filter @novel/web lint --fix 自动修复"

# 3. Prisma Validate
run_check "Prisma Schema 验证" \
  "pnpm --filter @novel/server exec prisma validate" \
  "检查 apps/server/prisma/schema.prisma 语法"

LINT_END=$(date +%s)
LINT_TIME=$((LINT_END - LINT_START))

# ============================================================
# 检查汇总
# ============================================================
echo ""
echo -e "${BOLD}========================================${NC}"
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✅ 所有检查通过！耗时 ${LINT_TIME}s${NC}"
else
  echo -e "${RED}${BOLD}  ❌ 部分检查失败！耗时 ${LINT_TIME}s${NC}"
fi
echo -e "${BOLD}========================================${NC}"
echo -e "  通过: ${GREEN}${PASS_COUNT}${NC}  失败: ${RED}${FAIL_COUNT}${NC}"

if [[ ${#FAILED_CHECKS[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${RED}失败项:${NC}"
  for check in "${FAILED_CHECKS[@]}"; do
    echo -e "    ${RED}✗${NC} $check"
  done
fi
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
