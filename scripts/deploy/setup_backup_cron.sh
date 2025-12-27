#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/apps/resulam_dictionary}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups}"
DATABASE_URL="${DATABASE_URL:-}"
CRON_SCHEDULE="${CRON_SCHEDULE:-*/5 * * * *}"
LOG_FILE="${LOG_FILE:-/var/log/resulam-backup.log}"

if [[ -z "$S3_BUCKET" || -z "$DATABASE_URL" ]]; then
  echo "S3_BUCKET and DATABASE_URL are required." >&2
  exit 1
fi

CRON_CMD="cd $APP_DIR && DATABASE_URL=\"$DATABASE_URL\" S3_BUCKET=\"$S3_BUCKET\" S3_PREFIX=\"$S3_PREFIX\" ./scripts/backup_to_s3.sh >> $LOG_FILE 2>&1"

crontab -l 2>/dev/null | grep -v "backup_to_s3.sh" | crontab -
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_CMD") | crontab -

echo "Backup cron installed: $CRON_SCHEDULE"
