#!/usr/bin/env bash
#
# whyisee-community 发布脚本（在服务器上执行）
#
#   bash app/deploy/release.sh              # 拉代码 + 迁移 + 构建 + 重启 + 冒烟
#   bash app/deploy/release.sh --no-pull    # 代码已就位，只做迁移/构建/重启
#   bash app/deploy/release.sh --skip-build # 只迁移 + 重启（改配置场景）
#
# 设计约束（踩过的坑，别改）：
#   1. 环境变量一律从 systemd unit 读取，不读 app/.env —— 保证迁移和运行时
#      连的是同一个库。本机曾出现过迁移打到本地库、应用连远程库的事故。
#   2. app/uploads 是用户上传的图片，不在版本库内。本脚本只增量更新代码，
#      任何情况下不删除该目录。
#   3. 构建失败或重启后不健康 → 自动恢复上一份 dist，不留半死状态。
#
set -euo pipefail

SERVICE="${SERVICE:-whyisee-community}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"
RELEASE_ROOT="${RELEASE_ROOT:-$REPO_DIR/.release}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$RELEASE_ROOT/$STAMP"

DO_PULL=1
DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --skip-build) DO_BUILD=0 ;;
    -h|--help) sed -n '3,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[FAIL] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- 0. 环境变量
log "读取 $SERVICE 的运行时环境变量"
systemctl cat "$SERVICE" >/dev/null 2>&1 || die "找不到 systemd 服务 $SERVICE，先用 deploy/whyisee-community.service 注册"
while IFS= read -r kv; do
  [[ -z "$kv" ]] && continue
  export "$kv"
done < <(systemctl show "$SERVICE" -p Environment --value | tr ' ' '\n')
ok "DB=${DB_HOST:-?}:${DB_PORT:-?}/${DB_NAME:-?}?${DB_SCHEMA:-?}"
PORT="${PORT:-4321}"
ok "PORT=$PORT（standalone 未设 PORT 时默认 8080，线上 nginx 反代写的是 4321，两者必须一致）"

[[ -n "${DB_HOST:-}" && -n "${DB_PASSWORD:-}" ]] || die "systemd unit 里缺 DB_HOST / DB_PASSWORD"
[[ -d "$APP_DIR/node_modules" ]] || die "$APP_DIR/node_modules 不存在，先执行 cd $APP_DIR && npm ci"

# ---------------------------------------------------------------- 1. 代码
if [[ $DO_PULL -eq 1 ]]; then
  log "更新代码"
  if [[ -d "$REPO_DIR/.git" ]]; then
    BEFORE="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
    git -C "$REPO_DIR" fetch --quiet origin
    git -C "$REPO_DIR" merge --ff-only --quiet origin/main || die "无法快进合并，服务器上有本地改动，需人工处理"
    ok "$BEFORE → $(git -C "$REPO_DIR" rev-parse --short HEAD)"
  else
    warn "$REPO_DIR 不是 git 仓库，跳过拉取（代码需自行 rsync 到此处）"
  fi
fi

# 依赖是否过期：lock 文件比 node_modules 的安装戳更新就重装
LOCK_FILE="$APP_DIR/package-lock.json"
INSTALLED_STAMP="$APP_DIR/node_modules/.package-lock.json"
if [[ -f "$LOCK_FILE" && ( ! -f "$INSTALLED_STAMP" || "$LOCK_FILE" -nt "$INSTALLED_STAMP" ) ]]; then
  warn "package-lock.json 已更新，重装依赖（约 1~2 分钟）"
  ( cd "$APP_DIR" && npm ci --no-audit --no-fund )
  ok "依赖已重装"
fi

# 构建需要 devDependencies（astro/typescript），生产若曾用 --omit=dev 装过会缺
if [[ $DO_BUILD -eq 1 && ! -d "$APP_DIR/node_modules/astro" ]]; then
  warn "node_modules 缺 astro（可能装过 --omit=dev），补装完整依赖"
  ( cd "$APP_DIR" && npm ci --no-audit --no-fund )
fi

# ---------------------------------------------------------------- 2. 备份产物
log "备份当前构建产物"
mkdir -p "$BACKUP_DIR"
if [[ -d "$APP_DIR/dist" ]]; then
  cp -a "$APP_DIR/dist" "$BACKUP_DIR/dist"
  ok "dist → $BACKUP_DIR/dist"
else
  warn "无 dist 可备份（首次发布）"
fi

rollback() {
  printf '\n\033[1;31m!! 发布失败，回滚到上一份 dist\033[0m\n' >&2
  if [[ -d "$BACKUP_DIR/dist" ]]; then
    rm -rf "$APP_DIR/dist"
    cp -a "$BACKUP_DIR/dist" "$APP_DIR/dist"
    systemctl restart "$SERVICE" || true
    printf '\033[33m已恢复 %s 并重启，请查看 journalctl -u %s -n 50\033[0m\n' "$BACKUP_DIR/dist" "$SERVICE" >&2
  else
    printf '\033[31m没有可回滚的产物（首次发布），服务可能处于不可用状态\033[0m\n' >&2
  fi
  exit 1
}

# ---------------------------------------------------------------- 3. 迁移
log "应用数据库迁移（幂等，已应用的会跳过）"
( cd "$APP_DIR" && node --experimental-strip-types scripts/migrate.ts ) || die "迁移失败，代码未切换，服务仍在旧版本"
ok "迁移完成"

# ---------------------------------------------------------------- 4. 构建
if [[ $DO_BUILD -eq 1 ]]; then
  log "构建（astro build，约 40~90 秒）"
  ( cd "$APP_DIR" && npm run build ) || rollback
  [[ -f "$APP_DIR/dist/server/entry.mjs" ]] || rollback
  ok "构建产物就绪：$(du -sh "$APP_DIR/dist" | cut -f1)"
fi

# ---------------------------------------------------------------- 5. 重启
log "重启服务"
systemctl restart "$SERVICE"
for i in $(seq 1 20); do
  systemctl is-active --quiet "$SERVICE" && break
  sleep 0.5
done
systemctl is-active --quiet "$SERVICE" || rollback
ok "$SERVICE 已启动"

# ---------------------------------------------------------------- 6. 冒烟
log "冒烟检查（直连应用端口，绕过 nginx）"
for i in $(seq 1 20); do
  CODE="$(curl -s -o /tmp/_v1meta.json -w '%{http_code}' -m 3 "http://127.0.0.1:$PORT/api/v1/meta" 2>/dev/null || echo 000)"
  [[ "$CODE" == "200" ]] && break
  sleep 0.5
done
[[ "$CODE" == "200" ]] || rollback
node -e 'const d=require("/tmp/_v1meta.json"); if(!d.ok) process.exit(1)' || rollback
ok "/api/v1/meta → 200"

for p in "/api/health" "/api/v1/feed?limit=1"; do
  C="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:$PORT$p" || echo 000)"
  [[ "$C" == "200" ]] && ok "$p → 200" || warn "$p → $C（非致命，人工确认）"
done

# ---------------------------------------------------------------- 7. nginx 提醒
log "检查 nginx 是否已为 /api/v1 放宽限制"
NGINX_HIT="$(grep -rl "/api/v1/" /etc/nginx 2>/dev/null | head -1 || true)"
if [[ -z "$NGINX_HIT" ]]; then
  warn "/etc/nginx 下没有 /api/v1 的 location —— 上传会 413，且缓存头缺失"
  warn "把 deploy/nginx.example.conf 里那段 location /api/v1/ 贴进去后 nginx -t && systemctl reload nginx"
else
  ok "已存在配置：$NGINX_HIT"
  awk '/server_name whyisee.xyz/,0' "$NGINX_HIT" | grep -q "location /api/v1/" \
    && ok "/api/v1 location 已就位" \
    || warn "主站 server 块里没有 location /api/v1/，接口能跑但没有 no-store";
  grep -q "client_max_body_size" "$NGINX_HIT" || warn "缺 client_max_body_size，图片上传会 413"
fi

# ---------------------------------------------------------------- 8. 清理旧备份
ls -1dt "$RELEASE_ROOT"/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -rf

log "发布完成"
printf '    服务: %s  版本: %s  产物: %s\n' \
  "$SERVICE" "$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)" "$BACKUP_DIR"
printf '    外网自检: curl -s https://whyisee.xyz/api/v1/meta\n'
