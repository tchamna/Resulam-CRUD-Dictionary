#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-api_demo/docker-compose.yml}"
DATA_DIR="${DATA_DIR:-/var/lib/postgresql/data}"

echo "Running WAL-G base backup..."
docker compose -f "$COMPOSE_FILE" exec -T db wal-g backup-push "$DATA_DIR"
