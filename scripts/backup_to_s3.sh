#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

if [[ -z "$S3_BUCKET" ]]; then
  echo "S3_BUCKET is required." >&2
  exit 1
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
dump_file="african_dictionaries-${timestamp}.sql.gz"

echo "Dumping database..."
pg_dump "$DATABASE_URL" | gzip -c > "$dump_file"

if [[ ! -f "$dump_file" ]]; then
  echo "Dump failed." >&2
  exit 1
fi

echo "Uploading to s3://${S3_BUCKET}/${S3_PREFIX}/${dump_file}"
aws s3 cp "$dump_file" "s3://${S3_BUCKET}/${S3_PREFIX}/${dump_file}"

echo "Done."
