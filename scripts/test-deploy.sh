#!/usr/bin/env bash
set -euo pipefail

log_command() {
  local command="$1"
  shift

  {
    printf '%s' "$command"
    printf ' %q' "$@"
    printf '\n'
  } >> "$DEPLOY_TEST_LOG"
}

fake_git() {
  log_command git "$@"

  case "$1" in
    rev-parse)
      if [ -e "$FAKE_GIT_STATE" ]; then
        printf '%s\n' "$FAKE_CURRENT_COMMIT"
      else
        : > "$FAKE_GIT_STATE"
        printf '%s\n' "$FAKE_PREVIOUS_COMMIT"
      fi
      ;;
    fetch|merge)
      ;;
    merge-base)
      [ "${FAKE_CUTOVER_ANCESTOR:-true}" = "true" ]
      ;;
    diff)
      if [ -n "${FAKE_CHANGED_PATH:-}" ]; then
        printf '%s\0' "$FAKE_CHANGED_PATH"
      fi
      ;;
    show)
      printf '%s\n' \
        'name: letscube' \
        'services:' \
        '  api:' \
        '    image: letscube-app:${APP_IMAGE_TAG:-local}' \
        '  socket:' \
        '    image: letscube-app:${APP_IMAGE_TAG:-local}'
      ;;
    *)
      echo "Unexpected fake git command: $*" >&2
      return 1
      ;;
  esac
}

fake_docker() {
  log_command docker "$@"

  case "$1" in
    inspect)
      if [[ "$*" == *'.State.Health'* ]]; then
        if [ "${FAKE_UNHEALTHY_CONTAINER:-}" = "${*: -1}" ]; then
          printf 'unhealthy\n'
        else
          printf 'healthy\n'
        fi
      else
        printf 'sha256:old-image\n'
      fi
      return 0
      ;;
    builder|image)
      return 0
      ;;
    compose)
      shift
      ;;
    *)
      echo "Unexpected fake docker command: $*" >&2
      return 1
      ;;
  esac

  local args=("$@")
  local subcommand=""
  local service="${args[${#args[@]} - 1]}"
  local is_rollback="false"
  local arg

  for arg in "${args[@]}"; do
    case "$arg" in
      build|exec|logs|ps|run|up)
        if [ -z "$subcommand" ]; then
          subcommand="$arg"
        fi
        ;;
    esac
    if [[ "$arg" == */letscube-deploy.*/* ]]; then
      is_rollback="true"
    fi
  done

  if [ "$subcommand" = "ps" ]; then
    case "$service" in
      api)
        [ -z "${FAKE_RUNNING_API:-}" ] || printf '%s\n' "$FAKE_RUNNING_API"
        ;;
      socket)
        [ -z "${FAKE_RUNNING_SOCKET:-}" ] || printf '%s\n' "$FAKE_RUNNING_SOCKET"
        ;;
      nginx)
        [ -z "${FAKE_RUNNING_NGINX:-}" ] || printf '%s\n' "$FAKE_RUNNING_NGINX"
        ;;
      postgres)
        [ -z "${FAKE_RUNNING_POSTGRES:-}" ] || printf '%s\n' "$FAKE_RUNNING_POSTGRES"
        ;;
      redis)
        [ -z "${FAKE_RUNNING_REDIS:-}" ] || printf '%s\n' "$FAKE_RUNNING_REDIS"
        ;;
    esac
    return 0
  fi

  if [ "$subcommand" = "up" ] && [ "$service" = "socket" ]; then
    if [ "$is_rollback" = "true" ]; then
      {
        printf 'APP_IMAGE_TAG=%s\n' "${APP_IMAGE_TAG:-}"
        printf '%s\n' "${args[*]}"
      } > "$FAKE_ROLLBACK_MARKER"
    elif [ "${FAKE_FAIL_CURRENT_SOCKET:-false}" = "true" ]; then
      return 1
    fi
  fi
}

case "$(basename -- "$0")" in
  git)
    fake_git "$@"
    exit
    ;;
  docker)
    fake_docker "$@"
    exit
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy.sh"
CLASSIFIER_SCRIPT="$SCRIPT_DIR/classify-deploy-target.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-deploy-test.XXXXXX")"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}

trap cleanup EXIT

FAKE_BIN="$TEST_ROOT/bin"
mkdir -p "$FAKE_BIN"
ln -s "$SCRIPT_DIR/test-deploy.sh" "$FAKE_BIN/git"
ln -s "$SCRIPT_DIR/test-deploy.sh" "$FAKE_BIN/docker"

prepare_app() {
  local app_dir="$1"

  mkdir -p "$app_dir/scripts"
  cp "$DEPLOY_SCRIPT" "$app_dir/scripts/deploy.sh"
  cp "$CLASSIFIER_SCRIPT" "$app_dir/scripts/classify-deploy-target.sh"
}

assert_contains() {
  local value="$1"
  local expected="$2"

  if [[ "$value" != *"$expected"* ]]; then
    echo "Expected output to contain: $expected" >&2
    exit 1
  fi
}

command_line() {
  local file="$1"
  local expected="$2"
  local number=0
  local line

  while IFS= read -r line; do
    number=$((number + 1))
    if [[ "$line" == *"$expected"* ]]; then
      printf '%s\n' "$number"
      return 0
    fi
  done < "$file"

  echo "Missing command containing: $expected" >&2
  return 1
}

run_bootstrap_test() {
  local scenario="$TEST_ROOT/bootstrap"
  local app_dir="$scenario/app"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local git_state="$scenario/git-state"
  local rollback_marker="$scenario/rollback"
  local commit="1111111111111111111111111111111111111111"
  local backing_line
  local migration_line
  local socket_line
  local api_line

  mkdir -p "$scenario/tmp"
  prepare_app "$app_dir"

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    DEPLOY_WAIT_TIMEOUT_SECONDS=17 \
    ENV_FILE=.env.prod \
    FAKE_CURRENT_COMMIT="$commit" \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" > "$output" 2>&1

  assert_contains "$(<"$output")" \
    'Missing production services: postgres redis api socket nginx; deploying all.'
  assert_contains "$(<"$output")" '(target: all)'

  backing_line="$(command_line "$log" \
    'up -d --force-recreate --wait --wait-timeout 17 postgres')"
  migration_line="$(command_line "$log" 'run --rm --no-deps migrate')"
  socket_line="$(command_line "$log" \
    'up -d --no-deps --force-recreate --wait --wait-timeout 17 socket')"
  api_line="$(command_line "$log" \
    'up -d --no-deps --force-recreate --wait --wait-timeout 17 api')"

  if [ "$backing_line" -ge "$migration_line" ]; then
    echo 'Migrations ran before backing services became ready.' >&2
    exit 1
  fi
  if [ "$socket_line" -ge "$api_line" ]; then
    echo 'Bootstrap did not deploy socket before API.' >&2
    exit 1
  fi

  assert_contains "$(<"$log")" 'docker image prune -af --filter until=168h'
  assert_contains "$(<"$log")" 'docker builder prune -af --max-used-space 2GB'
}

run_compose_change_test() {
  local scenario="$TEST_ROOT/compose-change"
  local app_dir="$scenario/app"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local git_state="$scenario/git-state"
  local rollback_marker="$scenario/rollback"
  local previous_commit="1111111111111111111111111111111111111111"
  local current_commit="2222222222222222222222222222222222222222"

  mkdir -p "$scenario/tmp"
  prepare_app "$app_dir"

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    DEPLOY_WAIT_TIMEOUT_SECONDS=17 \
    ENV_FILE=.env.prod \
    FAKE_CHANGED_PATH=compose.prod.yml \
    FAKE_CURRENT_COMMIT="$current_commit" \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$previous_commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    FAKE_RUNNING_API=api-container \
    FAKE_RUNNING_NGINX=nginx-container \
    FAKE_RUNNING_SOCKET=socket-container \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" > "$output" 2>&1

  assert_contains "$(<"$log")" \
    'up -d --force-recreate --wait --wait-timeout 17 postgres redis'
  assert_contains "$(<"$log")" \
    'up -d --no-deps --force-recreate --wait --wait-timeout 17 nginx'
}

run_rollback_test() {
  local scenario="$TEST_ROOT/rollback"
  local app_dir="$scenario/app"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local git_state="$scenario/git-state"
  local rollback_marker="$scenario/rollback"
  local previous_commit="1111111111111111111111111111111111111111"
  local current_commit="2222222222222222222222222222222222222222"
  local rollback_details

  mkdir -p "$scenario/tmp"
  prepare_app "$app_dir"

  if PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    DEPLOY_WAIT_TIMEOUT_SECONDS=17 \
    ENV_FILE=.env.prod \
    FAKE_CHANGED_PATH=server/index.js \
    FAKE_CURRENT_COMMIT="$current_commit" \
    FAKE_FAIL_CURRENT_SOCKET=true \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$previous_commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    FAKE_RUNNING_API=api-container \
    FAKE_RUNNING_NGINX=nginx-container \
    FAKE_RUNNING_SOCKET=socket-container \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" > "$output" 2>&1; then
    echo 'Expected the simulated socket deployment to fail.' >&2
    exit 1
  fi

  if [ ! -f "$rollback_marker" ]; then
    echo 'Rollback did not recreate the socket service.' >&2
    exit 1
  fi

  rollback_details="$(<"$rollback_marker")"
  assert_contains "$rollback_details" "--project-directory $app_dir"
  assert_contains "$rollback_details" '/letscube-deploy.'
  assert_contains "$rollback_details" 'APP_IMAGE_TAG=rollback-socket-111111111111-'
  assert_contains "$(<"$log")" "git show $previous_commit:compose.yml"
  assert_contains "$(<"$log")" "git show $previous_commit:compose.prod.yml"

  if [ "$(<"$app_dir/.last-successful-deploy")" != "$previous_commit" ]; then
    echo 'Failed deployment changed the last successful commit.' >&2
    exit 1
  fi
  if grep -Eq 'docker (image|builder) prune' "$log"; then
    echo 'Failed deployment removed Docker data.' >&2
    exit 1
  fi

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    DEPLOY_WAIT_TIMEOUT_SECONDS=17 \
    ENV_FILE=.env.prod \
    FAKE_CHANGED_PATH=server/index.js \
    FAKE_CURRENT_COMMIT="$current_commit" \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$previous_commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    FAKE_RUNNING_API=api-container \
    FAKE_RUNNING_NGINX=nginx-container \
    FAKE_RUNNING_POSTGRES=postgres-container \
    FAKE_RUNNING_REDIS=redis-container \
    FAKE_RUNNING_SOCKET=socket-container \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" >> "$output" 2>&1

  if [ "$(<"$app_dir/.last-successful-deploy")" != "$current_commit" ]; then
    echo 'Successful retry did not record the deployed commit.' >&2
    exit 1
  fi

}

run_unhealthy_service_test() {
  local scenario="$TEST_ROOT/unhealthy"
  local app_dir="$scenario/app"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local git_state="$scenario/git-state"
  local rollback_marker="$scenario/rollback"
  local commit="3333333333333333333333333333333333333333"

  mkdir -p "$scenario/tmp"
  prepare_app "$app_dir"

  PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    DEPLOY_WAIT_TIMEOUT_SECONDS=17 \
    ENV_FILE=.env.prod \
    FAKE_CURRENT_COMMIT="$commit" \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    FAKE_RUNNING_API=api-container \
    FAKE_RUNNING_NGINX=nginx-container \
    FAKE_RUNNING_POSTGRES=postgres-container \
    FAKE_RUNNING_REDIS=redis-container \
    FAKE_RUNNING_SOCKET=socket-container \
    FAKE_UNHEALTHY_CONTAINER=api-container \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" > "$output" 2>&1

  assert_contains "$(<"$output")" 'Unhealthy production services: api:unhealthy; deploying all.'
  assert_contains "$(<"$log")" \
    'up -d --no-deps --force-recreate --wait --wait-timeout 17 socket'
  if grep -Fq 'up -d --force-recreate --wait --wait-timeout 17 postgres redis' "$log"; then
    echo 'An unhealthy API caused healthy backing services to be recreated.' >&2
    exit 1
  fi
}

run_privacy_floor_test() {
  local scenario="$TEST_ROOT/privacy-floor"
  local app_dir="$scenario/app"
  local log="$scenario/commands.log"
  local output="$scenario/output.log"
  local git_state="$scenario/git-state"
  local rollback_marker="$scenario/rollback"
  local previous_commit="2222222222222222222222222222222222222222"
  local current_commit="1111111111111111111111111111111111111111"

  mkdir -p "$scenario/tmp"
  prepare_app "$app_dir"
  printf '%s\n' "$previous_commit" > "$app_dir/.privacy-email-cutover"

  if PATH="$FAKE_BIN:$PATH" \
    APP_DIR="$app_dir" \
    DEPLOY_TEST_LOG="$log" \
    ENV_FILE=.env.prod \
    FAKE_CURRENT_COMMIT="$current_commit" \
    FAKE_CUTOVER_ANCESTOR=false \
    FAKE_GIT_STATE="$git_state" \
    FAKE_PREVIOUS_COMMIT="$previous_commit" \
    FAKE_ROLLBACK_MARKER="$rollback_marker" \
    TMPDIR="$scenario/tmp" \
    bash "$app_dir/scripts/deploy.sh" > "$output" 2>&1; then
    echo 'Expected a pre-cutover deployment to be rejected.' >&2
    exit 1
  fi

  assert_contains "$(<"$output")" 'predates the email privacy cutover'
  if grep -q '^docker ' "$log"; then
    echo 'Privacy floor rejection ran Docker commands.' >&2
    exit 1
  fi
}

run_bootstrap_test
run_compose_change_test
run_rollback_test
run_unhealthy_service_test
run_privacy_floor_test

echo 'Deploy script checks passed.'
