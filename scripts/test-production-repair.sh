#!/usr/bin/env bash
set -euo pipefail

log_command() {
  {
    printf 'APP_IMAGE_TAG=%s docker' "${APP_IMAGE_TAG:-}"
    printf ' %q' "$@"
    printf '\n'
  } >> "$REPAIR_TEST_LOG"
}

fake_docker() {
  log_command "$@"

  if [ "$1" = image ]; then
    printf '%s\n' "$REPAIR_TEST_SHA"
    return 0
  fi

  if [ "$1" = inspect ]; then
    if [[ "$*" == *org.opencontainers.image.revision* ]]; then
      printf '%s\n' "$REPAIR_TEST_SHA"
    elif grep -Fqx "${*: -1}" "$REPAIR_TEST_REPAIRED" 2> /dev/null; then
      printf 'healthy\n'
    elif [ "${*: -1}" = "${REPAIR_TEST_UNHEALTHY:-}" ]; then
      printf 'unhealthy\n'
    else
      printf 'healthy\n'
    fi
    return 0
  fi

  if [ "$1" != compose ]; then
    echo "Unexpected fake Docker command: $*" >&2
    return 1
  fi

  local service="${*: -1}"
  if [[ "$*" == *' ps '* ]]; then
    printf '%s-container\n' "$service"
  elif [[ "$*" == *' up '* ]]; then
    printf '%s-container\n' "$service" >> "$REPAIR_TEST_REPAIRED"
  fi
}

case "$(basename -- "$0")" in
  docker)
    fake_docker "$@"
    exit
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-repair-test.XXXXXX")"
SOURCE_SHA="5555555555555555555555555555555555555555"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/app/scripts"
ln -s "$SCRIPT_DIR/test-production-repair.sh" "$TEST_ROOT/bin/docker"
cp "$SCRIPT_DIR/check-production-health.sh" "$TEST_ROOT/app/scripts/"
chmod +x "$TEST_ROOT/app/scripts/check-production-health.sh"
touch "$TEST_ROOT/app/compose.yml" "$TEST_ROOT/app/compose.prod.yml" \
  "$TEST_ROOT/app/.env.prod" "$TEST_ROOT/repaired"
printf '%s\n' "$SOURCE_SHA" > "$TEST_ROOT/app/.last-successful-deploy"

PATH="$TEST_ROOT/bin:$PATH" \
  APP_DIR="$TEST_ROOT/app" \
  ENV_FILE=.env.prod \
  HEALTH_ATTEMPTS=1 \
  LOCK_FILE="$TEST_ROOT/deploy.lock" \
  REPAIR_TEST_LOG="$TEST_ROOT/docker.log" \
  REPAIR_TEST_REPAIRED="$TEST_ROOT/repaired" \
  REPAIR_TEST_SHA="$SOURCE_SHA" \
  REPAIR_TEST_UNHEALTHY=api-container \
  bash "$SCRIPT_DIR/repair-production-services.sh"

grep -Fq 'up -d --no-deps --force-recreate --wait --wait-timeout 90 api' \
  "$TEST_ROOT/docker.log"
if grep -Fq 'up -d --no-deps --force-recreate --wait --wait-timeout 90 postgres' \
  "$TEST_ROOT/docker.log"; then
  echo 'Repair replaced a healthy PostgreSQL container.' >&2
  exit 1
fi

echo 'Production service repair checks passed.'
