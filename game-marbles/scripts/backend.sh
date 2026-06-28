#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/tmp/backend"
PID_FILE="$RUNTIME_DIR/api.pid"
LOG_FILE="$RUNTIME_DIR/api.log"
TSX_BIN="$ROOT_DIR/node_modules/.bin/tsx"

load_env() {
  set -a
  if [[ -f "$ROOT_DIR/.env" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
  fi
  if [[ -f "$ROOT_DIR/.env.local" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env.local"
  fi
  set +a

  SITE_URL="${SITE_URL:-http://localhost:4325}"
  API_HEALTH_URL="${API_HEALTH_URL:-${SITE_URL%/}/api/health}"
}

ensure_runtime() {
  mkdir -p "$RUNTIME_DIR"
}

running_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  return 1
}

require_deps() {
  if [[ ! -x "$TSX_BIN" ]]; then
    echo "Missing dependencies. Run: npm install"
    exit 1
  fi
}

check_database() {
  echo "Checking database..."
  npm run server:check
}

migrate_database() {
  echo "Running migrations..."
  npm run server:migrate
}

wait_for_health() {
  local attempts=30
  local delay=0.35

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
      echo "Backend is ready: $API_HEALTH_URL"
      return 0
    fi
    sleep "$delay"
  done

  echo "Backend did not become healthy. Recent log:"
  tail -n 80 "$LOG_FILE" 2>/dev/null || true
  exit 1
}

start_backend() {
  ensure_runtime
  load_env
  require_deps

  if pid="$(running_pid)"; then
    echo "Backend already running (pid=$pid)."
    echo "Health: $API_HEALTH_URL"
    return 0
  fi

  if [[ "${SKIP_DB_CHECK:-0}" != "1" ]]; then
    check_database
  fi

  if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
    migrate_database
  fi

  : > "$LOG_FILE"
  echo "Starting backend..."
  echo "Log: $LOG_FILE"
  (
    cd "$ROOT_DIR"
    exec "$TSX_BIN" server/src/index.ts
  ) >>"$LOG_FILE" 2>&1 &

  echo "$!" > "$PID_FILE"
  wait_for_health
}

stop_backend() {
  ensure_runtime

  if ! pid="$(running_pid)"; then
    rm -f "$PID_FILE"
    echo "Backend is not running."
    return 0
  fi

  echo "Stopping backend (pid=$pid)..."
  kill -INT "$pid" 2>/dev/null || true

  for ((i = 1; i <= 30; i += 1)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Backend stopped."
      return 0
    fi
    sleep 0.2
  done

  echo "Backend did not stop gracefully, killing."
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Backend stopped."
}

status_backend() {
  load_env

  if pid="$(running_pid)"; then
    echo "Backend running (pid=$pid)."
    if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
      echo "Health OK: $API_HEALTH_URL"
    else
      echo "Health check failed: $API_HEALTH_URL"
    fi
    echo "Log: $LOG_FILE"
    return 0
  fi

  rm -f "$PID_FILE"
  echo "Backend is not running."
  return 0
}

logs_backend() {
  ensure_runtime
  if [[ "${1:-}" == "-f" || "${1:-}" == "--follow" ]]; then
    touch "$LOG_FILE"
    tail -f "$LOG_FILE"
  else
    tail -n "${LOG_LINES:-120}" "$LOG_FILE" 2>/dev/null || echo "No backend log yet."
  fi
}

usage() {
  cat <<'EOF'
Usage: scripts/backend.sh <command>

Commands:
  start       Start the API service in background
  stop        Stop the API service
  restart     Stop then start the API service
  status      Show PID and health status
  logs        Show recent backend logs
  logs -f     Follow backend logs

Environment:
  .env and .env.local are loaded automatically. .env.local overrides .env.
  SKIP_DB_CHECK=1 scripts/backend.sh start     Skip DB connection check
  SKIP_MIGRATE=1 scripts/backend.sh start      Skip migrations
EOF
}

case "${1:-}" in
  start)
    start_backend
    ;;
  stop)
    stop_backend
    ;;
  restart)
    stop_backend
    start_backend
    ;;
  status)
    status_backend
    ;;
  logs)
    logs_backend "${2:-}"
    ;;
  help | -h | --help | "")
    usage
    ;;
  *)
    echo "Unknown command: $1"
    usage
    exit 1
    ;;
esac
