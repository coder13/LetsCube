#!/usr/bin/env bash
set -euo pipefail

log_command() {
  {
    printf 'APP_IMAGE_TAG=%s docker' "${APP_IMAGE_TAG:-}"
    printf ' %q' "$@"
    printf '\n'
  } >> "$IMAGE_DEPLOY_TEST_LOG"
}

fake_docker() {
  log_command "$@"

  if [ "$1" = image ]; then
    case "$2" in
      inspect)
        if [[ "$*" == *org.opencontainers.image.revision* ]]; then
          printf '%s\n' "$IMAGE_DEPLOY_TEST_SHA"
        fi
        return 0
        ;;
      tag|prune) return 0 ;;
    esac
  fi

  if [ "$1" = inspect ]; then
    if [[ "$*" == *org.opencontainers.image.revision* ]]; then
      printf '%s\n' "$IMAGE_DEPLOY_TEST_SHA"
    elif [[ "$*" == *'.State.Health'* ]]; then
      printf 'healthy\n'
    else
      printf 'sha256:old-image\n'
    fi
    return 0
  fi

  if [ "$1" != compose ]; then
    echo "Unexpected fake Docker command: $*" >&2
    return 1
  fi

  local subcommand=""
  local service="${*: -1}"
  local arg
  for arg in "$@"; do
    case "$arg" in
      config|logs|ps|run|up)
        if [ -z "$subcommand" ]; then
          subcommand="$arg"
        fi
        ;;
    esac
  done

  if [ "$subcommand" = ps ] && [[ "$*" == *' -q '* ]]; then
    printf '%s-container\n' "$service"
  fi
  if [ "$subcommand" = up ] && [ "$service" = api ] \
    && [ "${FAKE_FAIL_CANDIDATE_API:-false}" = true ] \
    && [ "${APP_IMAGE_TAG:-}" = "$IMAGE_DEPLOY_TEST_SHA" ]; then
    return 1
  fi
}

fake_crontab() {
  if [ "${1:-}" = -l ]; then
    cat "$CRONTAB_TEST_STATE"
  else
    cp "$1" "$CRONTAB_TEST_STATE"
  fi
}

case "$(basename -- "$0")" in
  docker)
    fake_docker "$@"
    exit
    ;;
  crontab)
    fake_crontab "$@"
    exit
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-image-deploy-test.XXXXXX")"
SOURCE_SHA="4444444444444444444444444444444444444444"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

FAKE_BIN="$TEST_ROOT/bin"
mkdir -p "$FAKE_BIN"
ln -s "$SCRIPT_DIR/test-image-deploy.sh" "$FAKE_BIN/docker"
ln -s "$SCRIPT_DIR/test-image-deploy.sh" "$FAKE_BIN/crontab"

prepare_scenario() {
  local scenario="$1"
  local app_dir="$scenario/app"
  local release_dir="$scenario/release"

  mkdir -p "$app_dir/scripts" "$release_dir"
  printf 'production secrets\n' > "$app_dir/.env.prod"
  printf 'old compose\n' > "$app_dir/compose.yml"
  printf 'old production compose\n' > "$app_dir/compose.prod.yml"
  printf 'old nginx\n' > "$app_dir/nginx.conf"
  printf 'new compose\n' > "$release_dir/compose.yml"
  printf 'new production compose\n' > "$release_dir/compose.prod.yml"
  printf 'new nginx\n' > "$release_dir/nginx.conf"
  cp "$SCRIPT_DIR/check-production-health.sh" "$release_dir/check-production-health.sh"
  cp "$SCRIPT_DIR/repair-production-services.sh" "$release_dir/repair-production-services.sh"
  chmod +x "$release_dir/check-production-health.sh" \
    "$release_dir/repair-production-services.sh"
}

assert_order() {
  local log="$1"
  local first="$2"
  local second="$3"
  local first_line
  local second_line

  first_line="$(grep -n -m1 -F -- "$first" "$log" | cut -d: -f1)"
  second_line="$(grep -n -m1 -F -- "$second" "$log" | cut -d: -f1)"
  if [ -z "$first_line" ] || [ -z "$second_line" ] || [ "$first_line" -ge "$second_line" ]; then
    echo "Expected '$first' before '$second'." >&2
    exit 1
  fi
}

run_success_test() {
  local scenario="$TEST_ROOT/success"
  local log="$scenario/docker.log"
  prepare_scenario "$scenario"

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$scenario/app" \
    ENV_FILE=.env.prod \
    IMAGE_DEPLOY_TEST_LOG="$log" \
    IMAGE_DEPLOY_TEST_SHA="$SOURCE_SHA" \
    HEALTH_ATTEMPTS=1 \
    LOCK_FILE="$scenario/deploy.lock" \
    bash "$SCRIPT_DIR/deploy-image-release.sh" "$SOURCE_SHA" "$scenario/release"

  test "$(<"$scenario/app/.last-successful-deploy")" = "$SOURCE_SHA"
  test "$(<"$scenario/app/compose.yml")" = 'new compose'
  assert_order "$log" 'run --rm --no-deps migrate' \
    "up -d --no-deps --force-recreate --wait --wait-timeout 90 socket"
  assert_order "$log" \
    "up -d --no-deps --force-recreate --wait --wait-timeout 90 socket" \
    "up -d --no-deps --force-recreate --wait --wait-timeout 90 api"
}

run_rollback_test() {
  local scenario="$TEST_ROOT/rollback"
  local log="$scenario/docker.log"
  prepare_scenario "$scenario"

  if PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$scenario/app" \
    ENV_FILE=.env.prod \
    FAKE_FAIL_CANDIDATE_API=true \
    IMAGE_DEPLOY_TEST_LOG="$log" \
    IMAGE_DEPLOY_TEST_SHA="$SOURCE_SHA" \
    HEALTH_ATTEMPTS=1 \
    LOCK_FILE="$scenario/deploy.lock" \
    bash "$SCRIPT_DIR/deploy-image-release.sh" "$SOURCE_SHA" "$scenario/release"; then
    echo 'Expected the candidate API deployment to fail.' >&2
    exit 1
  fi

  test ! -e "$scenario/app/.last-successful-deploy"
  test "$(<"$scenario/app/compose.yml")" = 'old compose'
  grep -Fq 'APP_IMAGE_TAG=rollback-socket-' "$log"
  grep -Fq 'APP_IMAGE_TAG=rollback-api-' "$log"
}

run_disable_cron_test() {
  local scenario="$TEST_ROOT/disable-cron"
  local state="$scenario/crontab"
  local backup="$scenario/crontab.backup"

  mkdir -p "$scenario"
  cat > "$state" <<'CRONTAB'
*/10 7-14 * * * cd /home/www/letscube && ./scripts/deploy.sh
17 8 * * * cd /home/www/letscube && ./scripts/backup-postgres.sh
CRONTAB

  PATH="$FAKE_BIN:$PATH" CRONTAB_TEST_STATE="$state" BACKUP_FILE="$backup" \
    bash "$SCRIPT_DIR/disable-legacy-deploy-cron.sh"

  grep -Fq 'scripts/deploy.sh' "$backup"
  grep -Fq 'scripts/backup-postgres.sh' "$state"
  grep -Fq 'scripts/repair-production-services.sh' "$state"
  if grep -Fq 'scripts/deploy.sh' "$state"; then
    echo 'Legacy deployment cron was not removed.' >&2
    exit 1
  fi

  PATH="$FAKE_BIN:$PATH" CRONTAB_TEST_STATE="$state" BACKUP_FILE="$backup" \
    bash "$SCRIPT_DIR/disable-legacy-deploy-cron.sh"
}

run_success_test
run_rollback_test
run_disable_cron_test
echo 'Image deployment checks passed.'
