#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-}"
if [[ -z "${TARGET_DIR}" || ! -f "${TARGET_DIR}/database.dump" || ! -f "${TARGET_DIR}/SHA256SUMS" ]]; then
  echo "用法：scripts/verify-backup.sh <备份目录>" >&2
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  (cd "${TARGET_DIR}" && shasum -a 256 -c SHA256SUMS)
else
  (cd "${TARGET_DIR}" && sha256sum -c SHA256SUMS)
fi
TOOLCHAIN="local"
if [[ -f "${TARGET_DIR}/TOOLCHAIN" ]]; then
  IFS= read -r TOOLCHAIN < "${TARGET_DIR}/TOOLCHAIN"
fi

if [[ "${TOOLCHAIN}" == docker:* ]]; then
  PG_CONTAINER="${TOOLCHAIN#docker:}"
  docker exec -i "${PG_CONTAINER}" pg_restore --list - < "${TARGET_DIR}/database.dump" >/dev/null
else
  pg_restore --list "${TARGET_DIR}/database.dump" >/dev/null
fi
echo "校验和与 PostgreSQL 归档目录均有效。正式恢复演练仍应在隔离数据库执行。"
