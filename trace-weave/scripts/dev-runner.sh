#!/usr/bin/env bash

set -u

# launchd uses a minimal environment; keep the common Node/npm locations available.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${PROJECT_ROOT}/.runtime"
BACKEND_LOG="${RUNTIME_DIR}/backend.log"
FRONTEND_LOG="${RUNTIME_DIR}/frontend.log"

mkdir -p "${RUNTIME_DIR}"

BACKEND_PID=""
FRONTEND_PID=""
SHUTTING_DOWN=0

terminate_tree() {
  local target_pid="$1"
  local signal_name="${2:-TERM}"
  local child_pid

  while IFS= read -r child_pid; do
    if [[ -n "${child_pid}" ]]; then
      terminate_tree "${child_pid}" "${signal_name}"
    fi
  done < <(pgrep -P "${target_pid}" 2>/dev/null || true)

  kill "-${signal_name}" "${target_pid}" 2>/dev/null || true
}

shutdown() {
  if [[ "${SHUTTING_DOWN}" -eq 1 ]]; then
    return
  fi
  SHUTTING_DOWN=1

  if [[ -n "${BACKEND_PID}" ]]; then
    terminate_tree "${BACKEND_PID}" TERM
  fi
  if [[ -n "${FRONTEND_PID}" ]]; then
    terminate_tree "${FRONTEND_PID}" TERM
  fi

  wait 2>/dev/null || true
}

trap shutdown INT TERM EXIT

(
  cd "${PROJECT_ROOT}"
  exec npm run dev:backend
) >>"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

(
  cd "${PROJECT_ROOT}"
  exec npm run dev:frontend
) >>"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!

while true; do
  if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
    wait "${BACKEND_PID}" 2>/dev/null
    exit $?
  fi

  if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    wait "${FRONTEND_PID}" 2>/dev/null
    exit $?
  fi

  sleep 1
done
