#!/usr/bin/env bash
set -euo pipefail

log_command() {
  local command="$1"
  shift

  {
    printf '%s' "$command"
    printf ' %q' "$@"
    printf '\n'
  } >> "$MONGO_REHEARSAL_LOG"
}

fake_docker() {
  log_command docker "$@"

  if [ "$1" != "compose" ]; then
    echo "Unexpected fake docker command: $*" >&2
    return 1
  fi

  if [[ "$*" == *mongodump* ]]; then
    printf 'synthetic-mongo-archive'
    return 0
  fi

  if [[ "$*" == *mongorestore* ]]; then
    printf 'restore-input-bytes=%s\n' "$(wc -c)" >> "$MONGO_REHEARSAL_LOG"
    return 0
  fi

  echo "Unexpected fake Docker Compose command: $*" >&2
  return 1
}

case "$(basename -- "$0")" in
  docker)
    fake_docker "$@"
    exit
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-mongo.sh"
RESTORE_SCRIPT="$SCRIPT_DIR/restore-mongo.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-mongo-rehearsal.XXXXXX")"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}

trap cleanup EXIT

FAKE_BIN="$TEST_ROOT/bin"
mkdir -p "$FAKE_BIN"
ln -s "$SCRIPT_DIR/test-mongo-backup-restore.sh" "$FAKE_BIN/docker"

assert_contains() {
  local value="$1"
  local expected="$2"

  if [[ "$value" != *"$expected"* ]]; then
    echo "Expected output to contain: $expected" >&2
    exit 1
  fi
}

run_backup_test() {
  local scenario="$TEST_ROOT/backup"
  local backup_dir="$scenario/backups"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local backup_path

  mkdir -p "$scenario/app"

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$scenario/app" \
    BACKUP_DIR="$backup_dir" \
    MONGO_BACKUP_URI="mongodb://mongo:27017/letscube" \
    MONGO_REHEARSAL_LOG="$log" \
    bash "$BACKUP_SCRIPT" > "$output"

  backup_path="$(find "$backup_dir" -type f -name 'letscube-mongo-daily-*.archive.gz' -print -quit)"
  if [ ! -f "$backup_path" ]; then
    echo 'Backup script did not create a daily archive.' >&2
    exit 1
  fi

  if [ "$(<"$backup_path")" != 'synthetic-mongo-archive' ]; then
    echo 'Backup archive did not contain the synthetic Mongo dump.' >&2
    exit 1
  fi

  assert_contains "$(<"$output")" 'Created MongoDB backup:'
  assert_contains "$(<"$log")" 'mongodump'
  assert_contains "$(<"$log")" 'MONGO_BACKUP_URI=mongodb://mongo:27017/letscube'
}

run_restore_test() {
  local scenario="$TEST_ROOT/restore"
  local archive="$scenario/backup.archive.gz"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"

  mkdir -p "$scenario/app"
  printf 'synthetic restore archive' > "$archive"

  if printf 'NO\n' | PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$scenario/app" \
    MONGO_BACKUP_URI="mongodb://mongo:27017/letscube" \
    MONGO_REHEARSAL_LOG="$log" \
    bash "$RESTORE_SCRIPT" "$archive" > "$output"; then
    echo 'Restore accepted an invalid confirmation.' >&2
    exit 1
  fi

  if [ -e "$log" ]; then
    echo 'Restore invoked Docker before receiving the required confirmation.' >&2
    exit 1
  fi

  printf 'RESTORE\n' | PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$scenario/app" \
    MONGO_BACKUP_URI="mongodb://mongo:27017/letscube" \
    MONGO_REHEARSAL_LOG="$log" \
    bash "$RESTORE_SCRIPT" "$archive" > "$output"

  assert_contains "$(<"$output")" 'MongoDB restore completed.'
  assert_contains "$(<"$log")" 'mongorestore'
  assert_contains "$(<"$log")" '--drop'
  assert_contains "$(<"$log")" '--archive'
  assert_contains "$(<"$log")" '--gzip'
  assert_contains "$(<"$log")" 'restore-input-bytes=25'
}

run_backup_test
run_restore_test

echo 'MongoDB backup and restore rehearsal checks passed.'
