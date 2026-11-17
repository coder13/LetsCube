#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 2
fi

if [ "$BACKUP_DIR" = "/" ]; then
  echo "BACKUP_DIR cannot be the root directory." >&2
  exit 2
fi

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")

cd "$APP_DIR"
mkdir -p -- "$BACKUP_DIR"
umask 077

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/letscube-postgres-$timestamp.dump"
temporary_file="$(mktemp "$BACKUP_DIR/.letscube-postgres-$timestamp.XXXXXX")"

cleanup() {
  rm -f -- "$temporary_file"
}

trap cleanup EXIT

"${COMPOSE[@]}" exec -T postgres \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$temporary_file"

mv -- "$temporary_file" "$backup_file"
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -type f \
  -name 'letscube-postgres-*.dump' \
  -mtime "+$BACKUP_RETENTION_DAYS" \
  -print -delete

echo "Created PostgreSQL backup: $backup_file"
