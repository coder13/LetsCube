#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
MONGO_BACKUP_URI="${MONGO_BACKUP_URI:-mongodb://127.0.0.1:27017/letscube}"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/letscube-mongo-backup.archive.gz" >&2
  exit 2
fi

backup_path="$1"
if [ ! -f "$backup_path" ]; then
  echo "Backup archive not found: $backup_path" >&2
  exit 2
fi

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")

cat <<EOF
This will restore MongoDB from:
  $backup_path

The restore uses mongorestore --drop and will overwrite existing data in the
target database from MONGO_BACKUP_URI:
  $MONGO_BACKUP_URI
EOF

read -r -p "Type RESTORE to continue: " confirmation
if [ "$confirmation" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

cd "$APP_DIR"

"${COMPOSE[@]}" exec -T -e MONGO_BACKUP_URI="$MONGO_BACKUP_URI" mongo \
  sh -c 'mongorestore --uri="$MONGO_BACKUP_URI" --drop --archive --gzip' < "$backup_path"

echo "MongoDB restore completed."
