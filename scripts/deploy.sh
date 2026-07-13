#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"
DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-ff-only}"
DEPLOY_FORCE="${DEPLOY_FORCE:-false}"
DEPLOY_TARGET="${DEPLOY_TARGET:-auto}"
DEPLOY_WAIT_TIMEOUT_SECONDS="${DEPLOY_WAIT_TIMEOUT_SECONDS:-60}"

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")
ROLLBACK_COMPOSE=()
rollback_compose_dir=""

cleanup_deploy_files() {
  if [ -n "$rollback_compose_dir" ]; then
    rm -rf -- "$rollback_compose_dir"
  fi
}

trap cleanup_deploy_files EXIT

case "$DEPLOY_TARGET" in
  auto|api|socket|all|none)
    ;;
  *)
    echo "Unsupported DEPLOY_TARGET: $DEPLOY_TARGET" >&2
    echo "Use auto, api, socket, all, or none." >&2
    exit 2
    ;;
esac

if ! [[ "$DEPLOY_WAIT_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "DEPLOY_WAIT_TIMEOUT_SECONDS must be a positive integer." >&2
  exit 2
fi

cd "$APP_DIR"

previous_commit="$(git rev-parse HEAD)"
git fetch "$REMOTE" "$BRANCH"

case "$DEPLOY_STRATEGY" in
  ff-only)
    git merge --ff-only "$REMOTE/$BRANCH"
    ;;
  merge)
    git merge --no-edit "$REMOTE/$BRANCH"
    ;;
  *)
    echo "Unsupported DEPLOY_STRATEGY: $DEPLOY_STRATEGY" >&2
    echo "Use ff-only or merge." >&2
    exit 2
    ;;
esac

current_commit="$(git rev-parse HEAD)"

privacy_cutover_file="${PRIVACY_EMAIL_CUTOVER_FILE:-$APP_DIR/.privacy-email-cutover}"
if [ -f "$privacy_cutover_file" ]; then
  privacy_cutover_commit="$(tr -d '[:space:]' < "$privacy_cutover_file")"
  if ! [[ "$privacy_cutover_commit" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid email privacy cutover commit in $privacy_cutover_file" >&2
    exit 2
  fi
  if ! git merge-base --is-ancestor "$privacy_cutover_commit" "$current_commit"; then
    echo "Refusing to deploy $current_commit: it predates the email privacy cutover." >&2
    exit 1
  fi
fi

if [ "$DEPLOY_TARGET" = "auto" ]; then
  missing_services=()
  for service in api socket nginx; do
    if ! container_id="$("${COMPOSE[@]}" ps --status running -q "$service")"; then
      echo "Failed to inspect the $service container." >&2
      exit 1
    fi
    if [ -z "$container_id" ]; then
      missing_services+=("$service")
    fi
  done

  if [ "${#missing_services[@]}" -gt 0 ]; then
    echo "Missing runtime services: ${missing_services[*]}; deploying all."
    resolved_target="all"
  elif [ "$previous_commit" = "$current_commit" ]; then
    if [ "$DEPLOY_FORCE" != "true" ]; then
      echo "Already up to date at $current_commit"
      "${COMPOSE[@]}" ps
      exit 0
    fi

    # There is no diff to classify. DEPLOY_FORCE preserves the historical
    # behavior of replacing the complete application deployment.
    resolved_target="all"
  else
    mapfile -d '' changed_files < <(
      git diff --name-only --no-renames -z "$previous_commit" "$current_commit"
    )
    resolved_target="$(
      bash scripts/classify-deploy-target.sh "${changed_files[@]}"
    )"
  fi
else
  resolved_target="$DEPLOY_TARGET"
fi

case "$resolved_target" in
  api)
    selected_services=(api)
    ;;
  socket)
    selected_services=(socket)
    ;;
  all)
    # Roll out the backward-compatible socket handler before serving the new
    # browser client that depends on its result acknowledgments.
    selected_services=(socket api)
    ;;
  none)
    echo "Updated checkout to $current_commit; no application services selected."
    "${COMPOSE[@]}" ps
    exit 0
    ;;
  *)
    echo "Deploy classifier returned an invalid target: $resolved_target" >&2
    exit 2
    ;;
esac

echo "Deploying commit $current_commit (target: $resolved_target)"

print_retry_hint() {
  echo "Retry this checked-out commit with DEPLOY_TARGET=$resolved_target after correcting the failure." >&2
}

prepare_rollback_compose() {
  local project_dir

  project_dir="$(pwd -P)"
  rollback_compose_dir="$(mktemp -d "${TMPDIR:-/tmp}/letscube-deploy.XXXXXX")"

  if ! git show "$previous_commit:compose.yml" > "$rollback_compose_dir/compose.yml" \
    || ! git show "$previous_commit:compose.prod.yml" \
      > "$rollback_compose_dir/compose.prod.yml"; then
    echo "Failed to snapshot pre-deploy Compose configuration." >&2
    return 1
  fi

  ROLLBACK_COMPOSE=(
    docker compose
    --project-directory "$project_dir"
    -f "$rollback_compose_dir/compose.yml"
    -f "$rollback_compose_dir/compose.prod.yml"
    --env-file "$ENV_FILE"
  )
}

if ! prepare_rollback_compose; then
  print_retry_hint
  exit 1
fi

# Shell environment takes precedence over APP_IMAGE_TAG in the env file. This
# gives every deployed revision an immutable image tag while keeping direct
# Compose usage compatible with the default `local` tag.
export APP_IMAGE_TAG="$current_commit"

if ! "${COMPOSE[@]}" build api; then
  echo "Application image build failed; no application containers were replaced." >&2
  print_retry_hint
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --no-recreate --wait \
  --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" mongo postgres redis; then
  echo "Failed to start backing services; no application containers were replaced." >&2
  print_retry_hint
  exit 1
fi

if ! "${COMPOSE[@]}" run --rm --no-deps migrate; then
  echo "PostgreSQL migration failed; application containers were not replaced." >&2
  print_retry_hint
  exit 1
fi

declare -A rollback_image_ids=()
declare -A rollback_tags=()
deploy_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"

snapshot_service_image() {
  local service="$1"
  local container_id
  local image_id
  local rollback_tag

  container_id="$("${COMPOSE[@]}" ps -q "$service")"
  if [ -z "$container_id" ]; then
    echo "No running $service container found; this service has no rollback image."
    return 0
  fi

  image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  rollback_tag="rollback-${service}-${previous_commit:0:12}-${deploy_id}"
  docker image tag "$image_id" "letscube-app:$rollback_tag"

  rollback_image_ids["$service"]="$image_id"
  rollback_tags["$service"]="$rollback_tag"
  echo "Saved $service rollback image $image_id as letscube-app:$rollback_tag"
}

reload_nginx() {
  local compose_variable="${1:-COMPOSE}"
  local -n compose_command="$compose_variable"
  local container_id

  container_id="$("${compose_command[@]}" ps --status running -q nginx)"
  if [ -z "$container_id" ]; then
    echo "nginx is not running; starting it without replacing dependencies."
    "${compose_command[@]}" up -d --no-deps --wait \
      --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" nginx || return 1
  fi

  "${compose_command[@]}" exec -T nginx nginx -s reload
}

rollback_services() {
  local services=("$@")
  local original_tag="$APP_IMAGE_TAG"
  local rollback_failed="false"
  local restored_any="false"
  local index
  local service
  local rollback_tag

  echo "Restoring application services from their pre-deploy images." >&2

  for ((index=${#services[@]} - 1; index >= 0; index--)); do
    service="${services[$index]}"
    rollback_tag="${rollback_tags[$service]-}"

    if [ -z "$rollback_tag" ]; then
      echo "Cannot restore $service: there was no running pre-deploy container." >&2
      rollback_failed="true"
      continue
    fi

    export APP_IMAGE_TAG="$rollback_tag"
    if "${ROLLBACK_COMPOSE[@]}" up -d --no-deps --wait \
      --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" "$service"; then
      echo "Restored $service from ${rollback_image_ids[$service]}." >&2
      restored_any="true"
    else
      echo "Failed to restore $service. Recent logs:" >&2
      "${ROLLBACK_COMPOSE[@]}" logs --tail=120 "$service" >&2 || true
      rollback_failed="true"
    fi
  done

  export APP_IMAGE_TAG="$original_tag"

  if [ "$restored_any" = "true" ] && ! reload_nginx ROLLBACK_COMPOSE; then
    echo "Application service rollback completed, but nginx reload failed." >&2
    "${ROLLBACK_COMPOSE[@]}" logs --tail=120 nginx >&2 || true
    rollback_failed="true"
  fi

  [ "$rollback_failed" = "false" ]
}

# Snapshot every selected service before the first replacement. If a later
# service fails, the entire application portion of this deploy can return to a
# consistent set of exact pre-deploy images.
for service in "${selected_services[@]}"; do
  snapshot_service_image "$service"
done

attempted_services=()

last_service_index=$((${#selected_services[@]} - 1))

for service_index in "${!selected_services[@]}"; do
  service="${selected_services[$service_index]}"
  attempted_services+=("$service")

  if ! "${COMPOSE[@]}" up -d --no-deps --wait \
    --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" "$service"; then
    echo "$service deployment failed. Recent logs:" >&2
    "${COMPOSE[@]}" logs --tail=120 "$service" >&2 || true
    rollback_services "${attempted_services[@]}" || \
      echo "Automatic rollback was incomplete; manual intervention is required." >&2
    print_retry_hint
    exit 1
  fi

  # On a bootstrap deployment, nginx cannot start until both application
  # services exist because its config resolves both upstream names. Existing
  # nginx containers are still reloaded after each selected replacement.
  if [ "$service_index" -lt "$last_service_index" ] \
    && [ -z "$("${COMPOSE[@]}" ps --status running -q nginx)" ]; then
    echo "nginx is not running; deferring startup until selected services are ready."
    continue
  fi

  if ! reload_nginx COMPOSE; then
    echo "Failed to reload nginx after the $service deployment. Recent logs:" >&2
    "${COMPOSE[@]}" logs --tail=120 "$service" nginx >&2 || true
    rollback_services "${attempted_services[@]}" || \
      echo "Automatic rollback was incomplete; manual intervention is required." >&2
    print_retry_hint
    exit 1
  fi
done

echo "Deployment complete: $resolved_target now uses letscube-app:$current_commit"
"${COMPOSE[@]}" ps
