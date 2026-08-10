#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_SCRIPT="$ROOT_DIR/scripts/backend.sh"
FRONTEND_RUNTIME_DIR="$ROOT_DIR/tmp/frontend"
FRONTEND_PID_FILE="$FRONTEND_RUNTIME_DIR/vite.pid"
FRONTEND_LOG_FILE="$FRONTEND_RUNTIME_DIR/vite.log"

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

  FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
  FRONTEND_PORT="${FRONTEND_PORT:-5173}"
  FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
  SITE_URL="${SITE_URL:-http://localhost:4325}"
  API_HEALTH_URL="${API_HEALTH_URL:-${SITE_URL%/}/api/health}"
}

ensure_runtime() {
  mkdir -p "$FRONTEND_RUNTIME_DIR"
}

frontend_pid() {
  if [[ -f "$FRONTEND_PID_FILE" ]]; then
    local pid
    pid="$(cat "$FRONTEND_PID_FILE")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  return 1
}

wait_for_frontend() {
  local attempts=40
  local delay=0.35

  for ((i = 1; i <= attempts; i += 1)); do
    if [[ -f "$FRONTEND_PID_FILE" ]] && ! frontend_pid >/dev/null; then
      echo "Frontend process exited before becoming ready. Recent log:"
      tail -n 80 "$FRONTEND_LOG_FILE" 2>/dev/null || true
      exit 1
    fi
    if curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
      echo "Frontend is ready: $FRONTEND_URL"
      return 0
    fi
    sleep "$delay"
  done

  echo "Frontend did not become ready. Recent log:"
  tail -n 80 "$FRONTEND_LOG_FILE" 2>/dev/null || true
  exit 1
}

start_frontend() {
  ensure_runtime
  load_env

  if pid="$(frontend_pid)"; then
    echo "Frontend already running (pid=$pid)."
    echo "URL: $FRONTEND_URL"
    return 0
  fi

  : > "$FRONTEND_LOG_FILE"
  echo "Starting frontend..."
  echo "Log: $FRONTEND_LOG_FILE"
  FRONTEND_ROOT="$ROOT_DIR" FRONTEND_LOG="$FRONTEND_LOG_FILE" FRONTEND_PID_FILE="$FRONTEND_PID_FILE" FRONTEND_HOST="$FRONTEND_HOST" FRONTEND_PORT="$FRONTEND_PORT" node <<'NODE'
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const logFd = fs.openSync(process.env.FRONTEND_LOG, "a");
const child = spawn("npm", ["run", "dev", "--", "--host", process.env.FRONTEND_HOST, "--port", process.env.FRONTEND_PORT, "--strictPort"], {
  cwd: process.env.FRONTEND_ROOT,
  detached: true,
  env: process.env,
  stdio: ["ignore", logFd, logFd],
});

child.unref();
fs.writeFileSync(process.env.FRONTEND_PID_FILE, String(child.pid));
NODE
  wait_for_frontend
}

stop_frontend() {
  ensure_runtime
  load_env

  if ! pid="$(frontend_pid)"; then
    rm -f "$FRONTEND_PID_FILE"
    echo "Frontend is not running."
    return 0
  fi

  echo "Stopping frontend (pid=$pid)..."
  kill -INT -- "-$pid" 2>/dev/null || kill -INT "$pid" 2>/dev/null || true

  for ((i = 1; i <= 30; i += 1)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$FRONTEND_PID_FILE"
      echo "Frontend stopped."
      return 0
    fi
    sleep 0.2
  done

  echo "Frontend did not stop gracefully, killing."
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  sleep 0.5
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  rm -f "$FRONTEND_PID_FILE"
  echo "Frontend stopped."
}

status_frontend() {
  load_env

  if pid="$(frontend_pid)"; then
    echo "Frontend running (pid=$pid)."
    if curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
      echo "URL OK: $FRONTEND_URL"
    else
      echo "URL check failed: $FRONTEND_URL"
    fi
    echo "Log: $FRONTEND_LOG_FILE"
    return 0
  fi

  rm -f "$FRONTEND_PID_FILE"
  echo "Frontend is not running."
}

status_backend() {
  "$BACKEND_SCRIPT" status
}

start_all() {
  "$BACKEND_SCRIPT" start
  start_frontend
}

stop_all() {
  stop_frontend
  "$BACKEND_SCRIPT" stop
}

status_all() {
  echo "== Backend =="
  status_backend
  echo
  echo "== Frontend =="
  status_frontend
}

logs_service() {
  ensure_runtime
  local target="${1:-all}"
  local follow="${2:-}"
  local backend_log="$ROOT_DIR/tmp/backend/api.log"

  case "$target" in
    backend)
      if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        touch "$backend_log"
        tail -f "$backend_log"
      else
        tail -n "${LOG_LINES:-120}" "$backend_log" 2>/dev/null || echo "No backend log yet."
      fi
      ;;
    frontend)
      if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        touch "$FRONTEND_LOG_FILE"
        tail -f "$FRONTEND_LOG_FILE"
      else
        tail -n "${LOG_LINES:-120}" "$FRONTEND_LOG_FILE" 2>/dev/null || echo "No frontend log yet."
      fi
      ;;
    all)
      if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
        touch "$backend_log" "$FRONTEND_LOG_FILE"
        tail -f "$backend_log" "$FRONTEND_LOG_FILE"
      else
        echo "== Backend log =="
        tail -n "${LOG_LINES:-80}" "$backend_log" 2>/dev/null || echo "No backend log yet."
        echo
        echo "== Frontend log =="
        tail -n "${LOG_LINES:-80}" "$FRONTEND_LOG_FILE" 2>/dev/null || echo "No frontend log yet."
      fi
      ;;
    *)
      echo "Unknown log target: $target"
      usage
      exit 1
      ;;
  esac
}

usage() {
  cat <<'EOF'
Usage: scripts/services.sh <command>

Commands:
  start              Start backend and frontend
  stop               Stop frontend and backend
  restart            Stop then start both services
  status             Show backend and frontend status
  logs               Show recent logs for both services
  logs -f            Follow both service logs
  logs backend       Show backend logs
  logs frontend      Show frontend logs

Environment:
  .env and .env.local are loaded automatically. .env.local overrides .env.
  FRONTEND_PORT=5173 scripts/services.sh start
  FRONTEND_URL=http://localhost:5173 scripts/services.sh status
  SKIP_DB_CHECK=1 scripts/services.sh start
  SKIP_MIGRATE=1 scripts/services.sh start
EOF
}

case "${1:-}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  logs)
    if [[ "${2:-}" == "-f" || "${2:-}" == "--follow" ]]; then
      logs_service all "$2"
    else
      logs_service "${2:-all}" "${3:-}"
    fi
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
