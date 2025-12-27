#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${WALG_S3_PREFIX:-}" ]]; then
  echo "WALG_S3_PREFIX not set; skipping wal-fetch" >&2
  exit 1
fi

wal-g wal-fetch "$1" "$2"
