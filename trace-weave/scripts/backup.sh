#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/backend/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少 backend/.env" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

BACKUP_ROOT="${TRACEWEAVE_BACKUP_DIR:-${PROJECT_ROOT}/.backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT}/${STAMP}"
mkdir -p "${TARGET_DIR}"
chmod 700 "${BACKUP_ROOT}" "${TARGET_DIR}"

PARTIAL_DUMP="${TARGET_DIR}/database.dump.partial"
trap 'rm -f "${PARTIAL_DUMP}"' EXIT

if [[ -n "${TRACEWEAVE_PG_DUMP_CONTAINER:-}" ]]; then
  DUMP_TOOLCHAIN="docker:${TRACEWEAVE_PG_DUMP_CONTAINER}"
  docker exec -e PGPASSWORD="${DB_PASSWORD}" "${TRACEWEAVE_PG_DUMP_CONTAINER}" pg_dump \
    --host=127.0.0.1 --port="${TRACEWEAVE_PG_DUMP_CONTAINER_PORT:-5432}" \
    --username="${DB_USER}" --dbname="${DB_NAME}" --schema="${DB_SCHEMA}" \
    --format=custom --compress=9 --no-owner --no-privileges --file=- > "${PARTIAL_DUMP}"
else
  DUMP_TOOLCHAIN="local"
  PGPASSWORD="${DB_PASSWORD}" pg_dump \
    --host="${DB_HOST}" --port="${DB_PORT}" --username="${DB_USER}" --dbname="${DB_NAME}" \
    --schema="${DB_SCHEMA}" --format=custom --compress=9 --no-owner --no-privileges \
    --file="${PARTIAL_DUMP}"
fi

mv "${PARTIAL_DUMP}" "${TARGET_DIR}/database.dump"
printf '%s\n' "${DUMP_TOOLCHAIN}" > "${TARGET_DIR}/TOOLCHAIN"

if command -v shasum >/dev/null 2>&1; then
  (cd "${TARGET_DIR}" && shasum -a 256 database.dump > SHA256SUMS)
else
  (cd "${TARGET_DIR}" && sha256sum database.dump > SHA256SUMS)
fi

chmod 600 "${TARGET_DIR}/database.dump" "${TARGET_DIR}/SHA256SUMS" "${TARGET_DIR}/TOOLCHAIN"
echo "数据库备份已创建：${TARGET_DIR}"
echo "对象存储附件需同时启用 bucket 版本控制/跨区复制；本脚本不会把私密媒体复制到本机。"
