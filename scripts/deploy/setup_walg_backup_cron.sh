#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/apps/resulam_dictionary}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 * * * *}"
LOG_FILE="${LOG_FILE:-/var/log/resulam-walg-backup.log}"

CRON_CMD="cd $APP_DIR && ./scripts/backup_walg.sh >> $LOG_FILE 2>&1"

crontab -l 2>/dev/null | grep -v "backup_walg.sh" | crontab -
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_CMD") | crontab -

echo "WAL-G base backup cron installed: $CRON_SCHEDULE"
