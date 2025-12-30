#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-api_demo/docker-compose.yml}"
DATA_DIR="${DATA_DIR:-/var/lib/postgresql/data}"
WALG_S3_PREFIX="${WALG_S3_PREFIX:-}"

if [[ -z "$WALG_S3_PREFIX" ]]; then
  echo "WALG_S3_PREFIX not set; skipping WAL-G backup."
  exit 0
fi

echo "Running WAL-G base backup..."
docker compose -f "$COMPOSE_FILE" exec -T db wal-g backup-push "$DATA_DIR"
