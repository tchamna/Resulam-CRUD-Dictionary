#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${WALG_S3_PREFIX:-}" ]]; then
  echo "WALG_S3_PREFIX not set; skipping wal-push" >&2
  exit 0
fi

exec wal-g wal-push "$1"
