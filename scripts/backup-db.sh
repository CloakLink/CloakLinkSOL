#!/usr/bin/env bash
set -euo pipefail

DB_URL=${DATABASE_URL:-postgresql://cloaklink:cloaklink@localhost:5432/cloaklink}
DESTINATION=${1:-backups/cloaklink-$(date +%Y%m%d%H%M%S).dump}

echo "Backing up database from ${DB_URL} to ${DESTINATION}"
mkdir -p "$(dirname "${DESTINATION}")"
pg_dump --format=custom --dbname="${DB_URL}" --file="${DESTINATION}"
