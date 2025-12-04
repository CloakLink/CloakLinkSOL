#!/usr/bin/env bash
set -euo pipefail

DB_URL=${DATABASE_URL:-postgresql://cloaklink:cloaklink@localhost:5432/cloaklink}
BACKUP_FILE=${1:-}

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file ${BACKUP_FILE} not found" >&2
  exit 1
fi

echo "Restoring ${BACKUP_FILE} into ${DB_URL}"
pg_restore --clean --if-exists --dbname="${DB_URL}" "${BACKUP_FILE}"
