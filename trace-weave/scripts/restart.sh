#!/usr/bin/env bash

# Some deployment tools invoke shell scripts with `sh`, which ignores the
# shebang. Re-exec with Bash before the script reaches Bash-only syntax such as
# process substitution.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${PROJECT_ROOT}/.runtime"
PID_FILE="${RUNTIME_DIR}/trace-weave.pid"
RUNNER_SCRIPT="${SCRIPT_DIR}/dev-runner.sh"
BACKEND_LOG="${RUNTIME_DIR}/backend.log"
FRONTEND_LOG="${RUNTIME_DIR}/frontend.log"
ACTION="${1:-restart}"
LAUNCHD_LABEL="com.traceweave.dev"
LAUNCHD_DOMAIN="gui/$(id -u)"

mkdir -p "${RUNTIME_DIR}"

uses_launchd() {
  [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1
}

launchd_job_exists() {
  uses_launchd && launchctl print "${LAUNCHD_DOMAIN}/${LAUNCHD_LABEL}" >/dev/null 2>&1
}

is_our_runner() {
  local pid_value="$1"
  local command_line
  command_line="$(ps -p "${pid_value}" -o command= 2>/dev/null || true)"
  [[ "${command_line}" == *"${RUNNER_SCRIPT}"* ]]
}

discover_runner_pid() {
  local pid_value
  local command_line
  local process_list
  process_list="$(ps -axo pid=,command= 2>/dev/null || true)"
  while read -r pid_value command_line; do
    if [[ "${command_line}" == *"/bin/bash ${RUNNER_SCRIPT}"* ]]; then
      printf '%s' "${pid_value}"
      return 0
    fi
  done <<EOF
${process_list}
EOF
  return 1
}

read_pid() {
  local pid_value=""
  if [[ -f "${PID_FILE}" ]]; then
    pid_value="$(tr -d '[:space:]' < "${PID_FILE}")"
    # A submitted launchd job is the authoritative owner of this PID. This also
    # keeps `status` useful in restricted shells where reading `ps` is denied.
    if [[ "${pid_value}" =~ ^[0-9]+$ ]] && launchd_job_exists; then
      printf '%s' "${pid_value}"
      return 0
    fi
    if [[ "${pid_value}" =~ ^[0-9]+$ ]] && is_our_runner "${pid_value}"; then
      printf '%s' "${pid_value}"
      return 0
    fi
  fi

  pid_value="$(discover_runner_pid 2>/dev/null || true)"
  if [[ -z "${pid_value}" ]]; then
    return 1
  fi
  printf '%s\n' "${pid_value}" > "${PID_FILE}"
  printf '%s' "${pid_value}"
}

is_running() {
  local pid_value
  pid_value="$(read_pid 2>/dev/null || true)"
  [[ -n "${pid_value}" ]] && kill -0 "${pid_value}" 2>/dev/null
}

stop_services() {
  local pid_value
  pid_value="$(read_pid 2>/dev/null || true)"

  if launchd_job_exists; then
    echo "正在停止织络${pid_value:+（PID ${pid_value}）}…"
    launchctl remove "${LAUNCHD_LABEL}"

    local launchd_attempt
    for launchd_attempt in {1..20}; do
      if [[ -z "$(discover_runner_pid 2>/dev/null || true)" ]]; then
        rm -f "${PID_FILE}"
        echo "织络已停止"
        return
      fi
      sleep 0.25
    done
    echo "launchd 已移除任务，但 runner 未在 5 秒内退出" >&2
    return 1
  fi

  if [[ -z "${pid_value}" ]] || ! kill -0 "${pid_value}" 2>/dev/null; then
    rm -f "${PID_FILE}"
    echo "织络当前未运行"
    return
  fi

  if ! is_our_runner "${pid_value}"; then
    echo "拒绝停止 PID ${pid_value}：PID 文件可能已过期，进程并非织络 runner" >&2
    echo "请检查 ${PID_FILE} 后手动处理" >&2
    exit 1
  fi

  echo "正在停止织络（PID ${pid_value}）…"
  kill -TERM "${pid_value}"

  local attempt
  for attempt in {1..20}; do
    if ! kill -0 "${pid_value}" 2>/dev/null; then
      rm -f "${PID_FILE}"
      echo "织络已停止"
      return
    fi
    sleep 0.25
  done

  echo "服务未在 5 秒内退出，正在强制停止 runner…" >&2
  kill -KILL "${pid_value}" 2>/dev/null || true
  rm -f "${PID_FILE}"
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempt

  for attempt in {1..40}; do
    if curl -fsS --max-time 1 "${url}" >/dev/null 2>&1; then
      echo "${name} 已就绪：${url}"
      return 0
    fi

    if ! is_running; then
      echo "${name} 启动失败，runner 已退出" >&2
      return 1
    fi
    sleep 0.5
  done

  echo "等待 ${name} 超时：${url}" >&2
  return 1
}

start_services() {
  if is_running; then
    local running_pid
    running_pid="$(read_pid)"
    echo "织络已在运行（PID ${running_pid}）"
    return
  fi

  rm -f "${PID_FILE}"
  touch "${BACKEND_LOG}" "${FRONTEND_LOG}"

  echo "正在检查数据库迁移…"
  (
    cd "${PROJECT_ROOT}"
    npm run db:migrate
  )

  local runner_pid
  if uses_launchd; then
    if launchd_job_exists; then
      launchctl remove "${LAUNCHD_LABEL}"
    fi
    launchctl submit -l "${LAUNCHD_LABEL}" -- /bin/bash "${RUNNER_SCRIPT}"
    local discovery_attempt
    runner_pid=""
    for discovery_attempt in {1..20}; do
      runner_pid="$(discover_runner_pid 2>/dev/null || true)"
      [[ -n "${runner_pid}" ]] && break
      sleep 0.1
    done
    if [[ -z "${runner_pid}" ]]; then
      echo "launchd 已接受任务，但未找到织络 runner" >&2
      exit 1
    fi
  else
    nohup /bin/bash "${RUNNER_SCRIPT}" >/dev/null 2>&1 &
    runner_pid=$!
  fi
  printf '%s\n' "${runner_pid}" > "${PID_FILE}"
  echo "正在启动织络（PID ${runner_pid}）…"

  if ! wait_for_url "后端" "http://127.0.0.1:8787/api/health"; then
    tail -n 30 "${BACKEND_LOG}" >&2 || true
    stop_services
    exit 1
  fi

  if ! wait_for_url "前端" "http://127.0.0.1:5173/"; then
    tail -n 30 "${FRONTEND_LOG}" >&2 || true
    stop_services
    exit 1
  fi

  echo "日志目录：${RUNTIME_DIR}"
}

show_status() {
  if is_running; then
    local running_pid
    running_pid="$(read_pid)"
    echo "织络正在运行（PID ${running_pid}）"
    echo "前端：http://127.0.0.1:5173/"
    echo "后端：http://127.0.0.1:8787/api/health"
  elif curl -fsS --max-time 3 "http://127.0.0.1:8787/api/health" >/dev/null 2>&1 \
    && curl -fsS --max-time 3 "http://127.0.0.1:5173/" >/dev/null 2>&1; then
    echo "织络正在运行（当前环境无权读取 runner PID）"
    echo "前端：http://127.0.0.1:5173/"
    echo "后端：http://127.0.0.1:8787/api/health"
  else
    echo "织络当前未运行"
    return 1
  fi
}

show_logs() {
  echo "==> backend.log <=="
  tail -n 40 "${BACKEND_LOG}" 2>/dev/null || echo "暂无后端日志"
  echo
  echo "==> frontend.log <=="
  tail -n 40 "${FRONTEND_LOG}" 2>/dev/null || echo "暂无前端日志"
}

case "${ACTION}" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    start_services
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "用法：$0 [start|stop|restart|status|logs]" >&2
    exit 2
    ;;
esac
