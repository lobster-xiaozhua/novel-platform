#!/bin/bash
set -euo pipefail

# ============================================================
# 墨卷 (Novel Platform) — 统一管理脚本
# 用法: ./novel.sh [子命令] [参数]
#   无参数  → 智能模式：首次→完整初始化，已配置→一键启动
# ============================================================

# ===== 彩色日志 =====
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}${BOLD}[STEP]${NC}  ${CYAN}$*${NC}"; }
success() { echo -e "${GREEN}${BOLD}[DONE]${NC}  $*"; }
fail()    { error "$@"; exit 1; }

# ===== 项目根目录检测 =====
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -f "pnpm-workspace.yaml" ]]; then
  fail "未找到 pnpm-workspace.yaml，请在项目根目录执行此脚本"
fi

# ===== Docker Compose 命令检测 =====
detect_compose_cmd() {
  if docker compose version &>/dev/null; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}
COMPOSE_CMD="$(detect_compose_cmd)"

# ===== 从 config.json 读取配置 =====
cfg() {
  local key="$1"
  node -e "const c=require('./config.json');const k='$key'.split('.');let v=c;for(const p of k){v=v[p]}console.log(v)" 2>/dev/null
}

# ===== 生成 .env =====
generate_env() {
  step "从 config.json 生成 .env"
  node -e "
    const c = require('./config.json');
    const lines = [
      '# ===== Database =====',
      'DATABASE_URL=postgresql://' + c.database.user + ':' + c.database.password + '@' + c.database.host + ':' + c.database.port + '/' + c.database.name,
      '',
      '# ===== Redis =====',
      'REDIS_URL=redis://' + (c.redis.password ? ':' + c.redis.password + '@' : '') + c.redis.host + ':' + c.redis.port,
      '',
      '# ===== Meilisearch =====',
      'MEILI_HOST=' + c.meilisearch.host,
      'MEILI_MASTER_KEY=' + c.meilisearch.masterKey,
      '',
      '# ===== JWT =====',
      'JWT_ACCESS_SECRET=' + c.jwt.accessSecret,
      'JWT_REFRESH_SECRET=' + c.jwt.refreshSecret,
      '',
      '# ===== App =====',
      'NEXT_PUBLIC_API_URL=http://localhost:' + c.app.port.server,
      'PORT=' + c.app.port.server,
    ];
    require('fs').writeFileSync('.env', lines.join('\n') + '\n');
  "
  success ".env 已从 config.json 生成"
}

# ===== 依赖检查 =====
check_deps() {
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

  check_command "node"
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
  if [[ "$NODE_MAJOR" -lt 20 ]]; then
    fail "Node.js 版本需 >= 20，当前: $(node --version)"
  fi

  check_command "pnpm"
  check_command "docker"

  success "系统依赖检查通过"
}

# ===== Docker 管理 =====
docker_start() {
  step "启动 Docker 基础设施 (PostgreSQL + Redis + Meilisearch)"
  $COMPOSE_CMD up -d postgres redis meilisearch
  success "Docker 基础设施已启动"
}

docker_stop() {
  step "停止所有 Docker 服务"
  $COMPOSE_CMD down
  success "Docker 服务已停止"
}

wait_for_infra() {
  local max_retries=30
  local retry=0

  # PostgreSQL
  info "等待 PostgreSQL..."
  retry=0
  while ! docker exec novel_postgres pg_isready -U novel &>/dev/null; do
    retry=$((retry + 1))
    if [[ $retry -ge $max_retries ]]; then
      fail "PostgreSQL 启动超时（${max_retries}次重试后仍不可用）"
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  info "PostgreSQL 已就绪"

  # Redis
  info "等待 Redis..."
  retry=0
  while ! docker exec novel_redis redis-cli ping &>/dev/null; do
    retry=$((retry + 1))
    if [[ $retry -ge 15 ]]; then
      fail "Redis 启动超时"
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  info "Redis 已就绪"

  # Meilisearch
  info "等待 Meilisearch..."
  retry=0
  while ! curl -sf http://localhost:7700/health &>/dev/null; do
    retry=$((retry + 1))
    if [[ $retry -ge 15 ]]; then
      fail "Meilisearch 启动超时"
    fi
    echo -n "."
    sleep 2
  done
  echo ""
  info "Meilisearch 已就绪"

  success "所有基础设施服务已就绪"
}

check_infra_running() {
  for svc in novel_postgres novel_redis novel_meilisearch; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
      return 1
    fi
  done
  return 0
}

ensure_infra() {
  if check_infra_running; then
    info "基础设施已在运行"
  else
    warn "基础设施未运行，正在启动..."
    docker_start
    wait_for_infra
  fi
}

# ===== 数据库管理 =====
PRISMA_CMD="pnpm --filter @novel/server exec prisma"

db_migrate() {
  step "执行数据库迁移"
  $PRISMA_CMD migrate deploy
  success "数据库迁移完成"
}

db_migrate_dev() {
  step "执行开发迁移 (migrate dev)"
  $PRISMA_CMD migrate dev
  success "开发迁移完成"
}

db_seed() {
  step "填充种子数据"

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

db_reset() {
  echo -e "${RED}${BOLD}⚠️  警告：此操作将删除所有数据并重置数据库！${NC}"
  echo -ne "${YELLOW}确认执行？输入 YES 继续: ${NC}"
  read -r confirm
  if [[ "$confirm" != "YES" ]]; then
    info "操作已取消"
    return 0
  fi
  step "重置数据库"
  $PRISMA_CMD migrate reset --force
  success "数据库已重置"
}

db_studio() {
  step "启动 Prisma Studio"
  info "Prisma Studio 将在浏览器中打开: https://localhost:5555"
  $PRISMA_CMD studio
}

db_status() {
  step "检查数据库状态"

  info "PostgreSQL 连接状态:"
  if docker exec novel_postgres pg_isready -U novel &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL 可连接"
  else
    echo -e "  ${RED}✗${NC} PostgreSQL 不可连接"
  fi

  info "迁移状态:"
  $PRISMA_CMD migrate status

  info "数据统计:"
  docker exec novel_postgres psql -U novel -d novel_platform -t -c "
    SELECT '  用户: ' || COUNT(*) FROM users UNION ALL
    SELECT '  小说: ' || COUNT(*) FROM novels UNION ALL
    SELECT '  章节: ' || COUNT(*) FROM chapters UNION ALL
    SELECT '  书架: ' || COUNT(*) FROM bookshelves;
  " 2>/dev/null || warn "无法获取数据统计"
}

db_cmd() {
  local sub="${1:-}"
  case "$sub" in
    migrate) db_migrate_dev ;;
    seed)    db_seed ;;
    reset)   db_reset ;;
    studio)  db_studio ;;
    status)  db_status ;;
    "")      echo -e "${BOLD}用法:${NC} ./novel.sh db <migrate|seed|reset|studio|status>"; exit 0 ;;
    *)       fail "未知 db 子命令: $sub\n可用: migrate, seed, reset, studio, status" ;;
  esac
}

# ===== 初始化 Meilisearch =====
init_meilisearch() {
  step "初始化 Meilisearch 索引"

  local MEILI_KEY
  MEILI_KEY=$(cfg "meilisearch.masterKey")

  curl -sf -X POST "http://localhost:7700/indexes" \
    -H "Authorization: Bearer $MEILI_KEY" \
    -H "Content-Type: application/json" \
    -d '{"uid":"novels","primaryKey":"id"}' &>/dev/null && info "novels 索引创建成功" || warn "novels 索引可能已存在"

  curl -sf -X POST "http://localhost:7700/indexes" \
    -H "Authorization: Bearer $MEILI_KEY" \
    -H "Content-Type: application/json" \
    -d '{"uid":"chapters","primaryKey":"id"}' &>/dev/null && info "chapters 索引创建成功" || warn "chapters 索引可能已存在"

  success "Meilisearch 索引初始化完成"
}

# ===== 构建项目 =====
build_project() {
  local CLEAN=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --clean) CLEAN=true; shift ;;
      *) shift ;;
    esac
  done

  if [[ "$CLEAN" == "true" ]]; then
    step "清理构建产物"
    rm -rf packages/shared/dist apps/server/dist apps/web/.next
    success "构建产物已清理"
  fi

  BUILD_START=$(date +%s)

  step "构建 @novel/shared"
  if ! pnpm --filter @novel/shared build; then
    fail "shared 包构建失败，请检查错误信息"
  fi
  success "shared 包构建完成"

  step "构建 @novel/server"
  if ! pnpm --filter @novel/server build; then
    fail "server 构建失败，请检查错误信息"
  fi
  success "server 构建完成"

  step "构建 @novel/web"
  if ! pnpm --filter @novel/web build; then
    fail "web 构建失败，请检查错误信息"
  fi
  success "web 构建完成"

  BUILD_END=$(date +%s)
  BUILD_TIME=$((BUILD_END - BUILD_START))

  echo ""
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo -e "${GREEN}${BOLD}  ✅ 构建完成！耗时 ${BUILD_TIME}s${NC}"
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo -e "  构建顺序: shared → server → web"
  echo -e "  产物路径:"
  echo -e "    ${CYAN}packages/shared/dist${NC}"
  echo -e "    ${CYAN}apps/server/dist${NC}"
  echo -e "    ${CYAN}apps/web/.next${NC}"
  echo ""
}

# ===== 测试 =====
run_tests() {
  local TEST_TYPE="all"
  local WATCH_MODE=false
  local COVERAGE=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --unit)     TEST_TYPE="unit";     shift ;;
      --e2e)      TEST_TYPE="e2e";      shift ;;
      --all)      TEST_TYPE="all";      shift ;;
      --watch)    WATCH_MODE=true;      shift ;;
      --coverage) COVERAGE=true;        shift ;;
      *) shift ;;
    esac
  done

  VITEST_ARGS=()
  [[ "$WATCH_MODE" == "true" ]] && VITEST_ARGS+=("--watch")
  [[ "$COVERAGE" == "true" ]] && VITEST_ARGS+=("--coverage")

  PASS_COUNT=0; FAIL_COUNT=0; SKIP_COUNT=0
  FAILED_PACKAGES=()

  run_test() {
    local pkg="$1" label="$2"
    step "测试 ${label}"
    if pnpm --filter "$pkg" test "${VITEST_ARGS[@]+"${VITEST_ARGS[@]}"}"; then
      PASS_COUNT=$((PASS_COUNT + 1))
      success "${label} 测试通过"
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_PACKAGES+=("$label")
      error "${label} 测试失败"
    fi
  }

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

  [[ $FAIL_COUNT -gt 0 ]] && exit 1
}

# ===== 代码检查 =====
run_lint() {
  PASS_COUNT=0; FAIL_COUNT=0; FAILED_CHECKS=()

  run_check() {
    local name="$1" cmd="$2" fix_hint="$3"
    step "${name}"
    if eval "$cmd"; then
      PASS_COUNT=$((PASS_COUNT + 1))
      success "${name} 通过"
    else
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_CHECKS+=("$name")
      error "${name} 失败"
      [[ -n "$fix_hint" ]] && echo -e "  ${YELLOW}修复提示: ${fix_hint}${NC}"
    fi
  }

  LINT_START=$(date +%s)

  run_check "TypeScript 类型检查 (shared)" \
    "pnpm --filter @novel/shared exec tsc --noEmit" \
    "检查 packages/shared 下的 TypeScript 类型错误"

  run_check "TypeScript 类型检查 (server)" \
    "pnpm --filter @novel/server exec tsc --noEmit" \
    "检查 apps/server 下的 TypeScript 类型错误"

  run_check "TypeScript 类型检查 (web)" \
    "pnpm --filter @novel/web exec tsc --noEmit" \
    "检查 apps/web 下的 TypeScript 类型错误"

  run_check "ESLint (web)" \
    "pnpm --filter @novel/web run lint" \
    "运行 pnpm --filter @novel/web lint --fix 自动修复"

  run_check "Prisma Schema 验证" \
    "pnpm --filter @novel/server exec prisma validate" \
    "检查 apps/server/prisma/schema.prisma 语法"

  LINT_END=$(date +%s)
  LINT_TIME=$((LINT_END - LINT_START))

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

  [[ $FAIL_COUNT -gt 0 ]] && exit 1
}

# ===== 启动开发服务 =====
start_dev() {
  local TARGET="all"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --web)    TARGET="web";    shift ;;
      --server) TARGET="server"; shift ;;
      --all)    TARGET="all";    shift ;;
      *) shift ;;
    esac
  done

  if [[ ! -f ".env" ]]; then
    fail "未找到 .env 文件，请先运行 ./novel.sh setup"
  fi

  ensure_infra

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

  step "启动开发服务 (目标: ${TARGET})"

  start_service() {
    local name="$1" cmd="$2"
    info "启动 ${name}..."
    eval "$cmd" &
    PIDS+=($!)
  }

  case "$TARGET" in
    web)    start_service "Web" "pnpm dev:web" ;;
    server) start_service "Server" "pnpm dev:server" ;;
    all)
      start_service "Server" "pnpm dev:server"
      start_service "Web" "pnpm dev:web"
      ;;
  esac

  local WEB_PORT; WEB_PORT=$(cfg "app.port.web")
  local SERVER_PORT; SERVER_PORT=$(cfg "app.port.server")

  echo ""
  success "开发服务已启动，按 Ctrl+C 停止"
  echo -e "  ${CYAN}Web:${NC}     http://localhost:${WEB_PORT}"
  echo -e "  ${CYAN}Server:${NC}  http://localhost:${SERVER_PORT}"
  echo ""

  for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

# ===== 部署 =====
deploy() {
  local DEPLOY_ENV="production"
  local ROLLBACK=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env)
        DEPLOY_ENV="${2:-}"
        [[ -z "$DEPLOY_ENV" ]] && fail "--env 需要指定环境名称"
        shift 2
        ;;
      --rollback) ROLLBACK=true; shift ;;
      *) shift ;;
    esac
  done

  if [[ "$DEPLOY_ENV" != "production" && "$DEPLOY_ENV" != "staging" ]]; then
    fail "无效环境: $DEPLOY_ENV，仅支持 production / staging"
  fi

  if [[ "$ROLLBACK" == "true" ]]; then
    step "回滚到上一版本"
    PREV_IMAGES=$(docker images --filter "reference=novel-platform-*" --format "{{.Repository}}:{{.Tag}}" | head -5)
    if [[ -z "$PREV_IMAGES" ]]; then
      fail "未找到可回滚的镜像"
    fi
    echo -e "${YELLOW}可用镜像:${NC}"
    echo "$PREV_IMAGES"
    echo ""

    local COMPOSE_FILE=""
    [[ -f "docker-compose.${DEPLOY_ENV}.yml" ]] && COMPOSE_FILE="-f docker-compose.${DEPLOY_ENV}.yml"

    $COMPOSE_CMD $COMPOSE_FILE down
    info "已停止当前服务"

    LAST_TAG=$(docker images --filter "reference=novel-platform-server" --format "{{.Tag}}" | sed -n '2p')
    [[ -n "$LAST_TAG" ]] && info "回滚到标签: $LAST_TAG"

    $COMPOSE_CMD $COMPOSE_FILE up -d
    success "回滚完成"
    exit 0
  fi

  DEPLOY_START=$(date +%s)
  TIMESTAMP=$(date +%Y%m%d%H%M%S)

  step "检查环境配置 (${DEPLOY_ENV})"
  if [[ -f ".env.${DEPLOY_ENV}" ]]; then
    info "使用 .env.${DEPLOY_ENV}"
  elif [[ -f ".env" ]]; then
    warn "未找到 .env.${DEPLOY_ENV}，使用 .env"
  else
    fail "未找到环境配置文件"
  fi

  step "构建 Docker 镜像"
  COMPOSE_FILES="-f docker-compose.yml"
  [[ -f "docker-compose.${DEPLOY_ENV}.yml" ]] && COMPOSE_FILES="-f docker-compose.yml -f docker-compose.${DEPLOY_ENV}.yml"
  $COMPOSE_CMD $COMPOSE_FILES build --no-cache
  success "Docker 镜像构建完成"

  docker tag novel-platform-server:latest "novel-platform-server:${TIMESTAMP}" 2>/dev/null || true
  docker tag novel-platform-web:latest "novel-platform-web:${TIMESTAMP}" 2>/dev/null || true
  info "镜像已标记: ${TIMESTAMP}"

  step "启动服务"
  $COMPOSE_CMD $COMPOSE_FILES up -d
  success "服务已启动"

  step "等待健康检查"
  wait_for_healthy() {
    local name="$1" max_retries=30 retry=0
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

  for svc in novel_postgres novel_redis; do
    wait_for_healthy "$svc" || warn "$svc 健康检查未通过"
  done

  sleep 5
  for svc in novel_server novel_web; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
      info "$svc: $(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo 'unknown')"
    fi
  done

  step "执行数据库迁移"
  $COMPOSE_CMD $COMPOSE_FILES exec -T server npx prisma migrate deploy 2>/dev/null || \
    pnpm --filter @novel/server exec prisma migrate deploy
  success "数据库迁移完成"

  step "服务状态"
  $COMPOSE_CMD $COMPOSE_FILES ps

  DEPLOY_END=$(date +%s)
  DEPLOY_TIME=$((DEPLOY_END - DEPLOY_START))

  echo ""
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo -e "${GREEN}${BOLD}  🚀 部署完成！环境: ${DEPLOY_ENV}  耗时: ${DEPLOY_TIME}s${NC}"
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo ""
}

# ===== 服务状态 =====
show_status() {
  step "服务状态"

  if ! docker ps &>/dev/null; then
    fail "Docker 未运行，请先启动 Docker"
  fi

  echo ""
  SERVICES=("novel_postgres" "novel_redis" "novel_meilisearch" "novel_server" "novel_web" "novel_nginx")

  for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
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

# ===== 查看日志 =====
show_logs() {
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

# ===== 清理 =====
clean_all() {
  echo -e "${RED}${BOLD}⚠️  警告：此操作将删除所有 Docker 数据和构建产物！${NC}"
  echo -e "${YELLOW}这将清除数据库数据、Redis 缓存、Meilisearch 索引等所有持久化数据${NC}"
  echo -ne "${YELLOW}确认执行？输入 YES 继续: ${NC}"
  read -r confirm

  if [[ "$confirm" != "YES" ]]; then
    info "操作已取消"
    return 0
  fi

  step "清理构建产物"
  rm -rf packages/shared/dist apps/server/dist apps/web/.next
  success "构建产物已清理"

  step "停止并删除所有容器和卷"
  $COMPOSE_CMD down -v --remove-orphans
  success "容器和卷已删除"

  step "清理项目相关镜像"
  docker image prune -f 2>/dev/null || true
  success "镜像已清理"

  info "Docker 资源使用情况:"
  docker system df 2>/dev/null || true
}

# ===== 完整初始化 =====
setup_all() {
  check_deps
  generate_env
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  success "依赖安装完成"

  step "构建 @novel/shared 包"
  pnpm --filter @novel/shared build
  success "shared 包构建完成"

  step "生成 Prisma 客户端"
  pnpm --filter @novel/server exec prisma generate
  success "Prisma 客户端生成完成"

  docker_start
  wait_for_infra
  db_migrate
  init_meilisearch

  echo ""
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo -e "${GREEN}${BOLD}  🎉 项目初始化完成！${NC}"
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo ""
  echo -e "  下一步操作："
  echo -e "  ${CYAN}1.${NC} 修改 ${BOLD}config.json${NC} 中的配置（如 JWT 密钥等）"
  echo -e "  ${CYAN}2.${NC} 运行 ${BOLD}./novel.sh${NC} 启动开发服务"
  echo -e "  ${CYAN}3.${NC} 运行 ${BOLD}./novel.sh db seed${NC} 填充测试数据"
  echo ""
}

# ===== 智能模式 =====
smart_start() {
  if [[ -f .env && -d node_modules ]]; then
    info "检测到已有配置，一键启动..."
    ensure_infra
    start_dev
  else
    info "首次运行，执行完整初始化..."
    setup_all
    start_dev
  fi
}

# ===== 用法 =====
usage() {
  echo -e "${BOLD}墨卷 (Novel Platform) 统一管理脚本${NC}"
  echo ""
  echo -e "${BOLD}用法:${NC} ./novel.sh [子命令] [参数]"
  echo ""
  echo -e "  ${CYAN}(无参数)${NC}      智能模式：首次→完整初始化，已配置→一键启动"
  echo -e "  ${CYAN}setup${NC}         强制完整初始化"
  echo -e "  ${CYAN}start${NC}         启动开发服务 [--web|--server|--all]"
  echo -e "  ${CYAN}stop${NC}          停止所有服务"
  echo -e "  ${CYAN}build${NC}         构建项目 [--clean]"
  echo -e "  ${CYAN}test${NC}          运行测试 [--unit|--e2e|--all] [--watch] [--coverage]"
  echo -e "  ${CYAN}deploy${NC}        部署到生产 [--env production|staging] [--rollback]"
  echo -e "  ${CYAN}db${NC}            数据库管理 (migrate|seed|reset|studio|status)"
  echo -e "  ${CYAN}lint${NC}          代码检查"
  echo -e "  ${CYAN}status${NC}        查看所有服务状态"
  echo -e "  ${CYAN}logs${NC} [svc]    查看日志 [服务名] [行数]"
  echo -e "  ${CYAN}clean${NC}         清理构建产物和 Docker 资源（危险）"
  echo ""
  exit 0
}

# ===== 主入口 =====
case "${1:-}" in
  setup)   shift; setup_all "$@" ;;
  start)   shift; start_dev "$@" ;;
  stop)    docker_stop ;;
  build)   shift; build_project "$@" ;;
  test)    shift; run_tests "$@" ;;
  deploy)  shift; deploy "$@" ;;
  db)      shift; db_cmd "${1:-}" ;;
  lint)    run_lint ;;
  status)  show_status ;;
  logs)    shift; show_logs "${1:-}" "${2:-100}" ;;
  clean)   clean_all ;;
  "")      smart_start ;;
  -h|--help) usage ;;
  *)       fail "未知子命令: $1\n使用 ./novel.sh --help 查看帮助" ;;
esac
