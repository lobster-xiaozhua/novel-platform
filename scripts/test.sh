#!/bin/bash
set -euo pipefail

# ============================================================
# Novel Platform — 测试脚本
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
TEST_TYPE="all"
WATCH_MODE=false
COVERAGE=false

usage() {
  echo -e "${BOLD}用法:${NC} $0 [--unit | --e2e | --all] [--watch] [--coverage]"
  echo ""
  echo "  --unit      仅运行单元测试"
  echo "  --e2e       仅运行 E2E 测试"
  echo "  --all       运行所有测试（默认）"
  echo "  --watch     监听模式"
  echo "  --coverage  生成覆盖率报告"
  echo "  -h,--help   查看帮助"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --unit)     TEST_TYPE="unit";     shift ;;
    --e2e)      TEST_TYPE="e2e";      shift ;;
    --all)      TEST_TYPE="all";      shift ;;
    --watch)    WATCH_MODE=true;      shift ;;
    --coverage) COVERAGE=true;        shift ;;
    -h|--help)  usage ;;
    *) fail "未知参数: $1" ;;
  esac
done

# ============================================================
# 构建测试参数
# ============================================================
VITEST_ARGS=()

if [[ "$WATCH_MODE" == "true" ]]; then
  VITEST_ARGS+=("--watch")
fi

if [[ "$COVERAGE" == "true" ]]; then
  VITEST_ARGS+=("--coverage")
fi

# ============================================================
# 测试结果追踪
# ============================================================
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_PACKAGES=()

run_test() {
  local pkg="$1"
  local label="$2"
  local extra_args=("${VITEST_ARGS[@]}")

  step "测试 ${label}"
  if pnpm --filter "$pkg" test "${extra_args[@]}"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    success "${label} 测试通过"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_PACKAGES+=("$label")
    error "${label} 测试失败"
  fi
}

# ============================================================
# 执行测试
# ============================================================
TEST_START=$(date +%s)

case "$TEST_TYPE" in
  unit)
    run_test "@novel/shared" "shared (单元测试)"
    run_test "@novel/server" "server (单元测试)"
    run_test "@novel/web"    "web (单元测试)"
    ;;
  e2e)
    step "E2E 测试"
    warn "E2E 测试需要完整运行环境，请确保服务已启动"
    if [[ -f "apps/web/playwright.config.ts" ]] || [[ -f "apps/web/playwright.config.js" ]]; then
      pnpm --filter @novel/web exec playwright test
    else
      warn "未找到 Playwright 配置，跳过 E2E 测试"
      SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
    ;;
  all)
    run_test "@novel/shared" "shared"
    run_test "@novel/server" "server"
    run_test "@novel/web"    "web"
    ;;
esac

TEST_END=$(date +%s)
TEST_TIME=$((TEST_END - TEST_START))

# ============================================================
# 测试汇总
# ============================================================
echo ""
echo -e "${BOLD}========================================${NC}"
if [[ $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✅ 所有测试通过！耗时 ${TEST_TIME}s${NC}"
else
  echo -e "${RED}${BOLD}  ❌ 部分测试失败！耗时 ${TEST_TIME}s${NC}"
fi
echo -e "${BOLD}========================================${NC}"
echo -e "  通过: ${GREEN}${PASS_COUNT}${NC}  失败: ${RED}${FAIL_COUNT}${NC}  跳过: ${YELLOW}${SKIP_COUNT}${NC}"

if [[ ${#FAILED_PACKAGES[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${RED}失败包:${NC}"
  for pkg in "${FAILED_PACKAGES[@]}"; do
    echo -e "    ${RED}✗${NC} $pkg"
  done
fi
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
