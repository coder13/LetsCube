#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/opt/letscube/backups}"
MONGO_BACKUP_URI="${MONGO_BACKUP_URI:-mongodb://127.0.0.1:27017/letscube}"

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
weekday="$(date -u +%u)"
monthday="$(date -u +%d)"
daily_backup="$BACKUP_DIR/letscube-mongo-daily-$timestamp.archive.gz"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

"${COMPOSE[@]}" exec -T -e MONGO_BACKUP_URI="$MONGO_BACKUP_URI" mongo \
  sh -c 'mongodump --uri="$MONGO_BACKUP_URI" --archive --gzip' > "$daily_backup"

created=("$daily_backup")

if [ "$weekday" = "7" ]; then
  weekly_backup="$BACKUP_DIR/letscube-mongo-weekly-$timestamp.archive.gz"
  cp "$daily_backup" "$weekly_backup"
  created+=("$weekly_backup")
fi

if [ "$monthday" = "01" ]; then
  monthly_backup="$BACKUP_DIR/letscube-mongo-monthly-$timestamp.archive.gz"
  cp "$daily_backup" "$monthly_backup"
  created+=("$monthly_backup")
fi

prune_backups() {
  local pattern="$1"
  local keep="$2"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v keep="$keep" 'NR > keep { $1=""; sub(/^ /, ""); print }' \
    | xargs -r rm -f
}

prune_backups 'letscube-mongo-daily-*.archive.gz' 7
prune_backups 'letscube-mongo-weekly-*.archive.gz' 4
prune_backups 'letscube-mongo-monthly-*.archive.gz' 3

if [ -n "${BACKUP_S3_URI:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "BACKUP_S3_URI is set, but aws CLI is not installed." >&2
    exit 1
  fi

  aws_args=()
  if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
    aws_args+=(--endpoint-url "$AWS_ENDPOINT_URL")
  fi

  for backup in "${created[@]}"; do
    aws "${aws_args[@]}" s3 cp "$backup" "$BACKUP_S3_URI/"
  done
fi

printf 'Created MongoDB backup: %s\n' "$daily_backup"
