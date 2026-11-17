#!/usr/bin/env bash
set -euo pipefail

case "$(basename -- "$0")" in
  docker)
    printf '%q ' docker "$@" >> "$BACKUP_TEST_LOG"
    printf '\n' >> "$BACKUP_TEST_LOG"
    printf 'test PostgreSQL backup\n'
    exit
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-postgres.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-backup-test.XXXXXX")"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}

trap cleanup EXIT

APP_DIR="$TEST_ROOT/app"
BACKUP_DIR="$TEST_ROOT/backups"
FAKE_BIN="$TEST_ROOT/bin"
BACKUP_TEST_LOG="$TEST_ROOT/docker.log"

mkdir -p "$APP_DIR" "$BACKUP_DIR" "$FAKE_BIN"
touch "$APP_DIR/compose.yml" "$APP_DIR/compose.prod.yml" "$APP_DIR/.env.prod"
ln -s "$SCRIPT_DIR/test-backup-postgres.sh" "$FAKE_BIN/docker"

stale_backup="$BACKUP_DIR/letscube-postgres-20261001T000000Z.dump"
unrelated_file="$BACKUP_DIR/keep.txt"
touch -d '16 days ago' "$stale_backup"
touch -d '16 days ago' "$unrelated_file"

PATH="$FAKE_BIN:$PATH" \
  APP_DIR="$APP_DIR" \
  BACKUP_DIR="$BACKUP_DIR" \
  BACKUP_RETENTION_DAYS=14 \
  BACKUP_TEST_LOG="$BACKUP_TEST_LOG" \
  "$BACKUP_SCRIPT" > "$TEST_ROOT/output.log"

mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'letscube-postgres-*.dump')

if [ "${#backups[@]}" -ne 1 ]; then
  echo "Expected one current PostgreSQL backup." >&2
  exit 1
fi

if [ "$(<"${backups[0]}")" != 'test PostgreSQL backup' ]; then
  echo "The PostgreSQL backup content is incorrect." >&2
  exit 1
fi

if [ -e "$stale_backup" ]; then
  echo "The stale PostgreSQL backup remains." >&2
  exit 1
fi

if [ ! -e "$unrelated_file" ]; then
  echo "The retention rule removed an unrelated file." >&2
  exit 1
fi

if ! grep -q 'exec -T postgres' "$BACKUP_TEST_LOG"; then
  echo "The backup did not use the PostgreSQL service." >&2
  exit 1
fi

if APP_DIR="$APP_DIR" BACKUP_DIR="$BACKUP_DIR" BACKUP_RETENTION_DAYS=invalid \
  "$BACKUP_SCRIPT" > /dev/null 2>&1; then
  echo "The backup accepted an invalid retention period." >&2
  exit 1
fi

echo "PostgreSQL backup script checks passed."
