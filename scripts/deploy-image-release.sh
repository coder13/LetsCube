#!/usr/bin/env bash
set -euo pipefail

SOURCE_SHA="${1:-}"
RELEASE_DIR="${2:-}"
APP_DIR="${APP_DIR:-/opt/letscube/runtime}"
ENV_FILE="${ENV_FILE:-/home/www/letscube/.env.prod}"
DEPLOY_WAIT_TIMEOUT_SECONDS="${DEPLOY_WAIT_TIMEOUT_SECONDS:-90}"
LOCK_FILE="${LOCK_FILE:-/tmp/letscube-deploy.lock}"

if ! [[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "A full source commit SHA is required." >&2
  exit 2
fi
if [ -z "$RELEASE_DIR" ] || [ ! -d "$RELEASE_DIR" ]; then
  echo "A release directory is required." >&2
  exit 2
fi
if [[ "$ENV_FILE" = /* ]]; then
  ENV_PATH="$ENV_FILE"
else
  ENV_PATH="$APP_DIR/$ENV_FILE"
fi
if [ ! -f "$ENV_PATH" ]; then
  echo "Missing production environment file: $ENV_PATH" >&2
  exit 1
fi

release_files=(compose.yml compose.prod.yml nginx.conf)
for file in "${release_files[@]}"; do
  if [ ! -f "$RELEASE_DIR/$file" ]; then
    echo "Missing release file: $RELEASE_DIR/$file" >&2
    exit 1
  fi
done
if [ ! -x "$RELEASE_DIR/check-production-health.sh" ]; then
  echo "Missing executable production health check." >&2
  exit 1
fi
if [ ! -x "$RELEASE_DIR/repair-production-services.sh" ]; then
  echo "Missing executable production repair script." >&2
  exit 1
fi

image="letscube-app:$SOURCE_SHA"
docker image inspect "$image" > /dev/null
image_source="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")"
if [ "$image_source" != "$SOURCE_SHA" ]; then
  echo "Image source label does not match $SOURCE_SHA." >&2
  exit 1
fi

exec 9> "$LOCK_FILE"
if ! flock -w 60 9; then
  echo "Another production deployment holds $LOCK_FILE." >&2
  exit 1
fi

mkdir -p "$APP_DIR/scripts"
rollback_dir="$(mktemp -d "${TMPDIR:-/tmp}/letscube-release-rollback.XXXXXX")"
config_staged=false
deployment_complete=false
declare -A rollback_tags=()

COMPOSE=(
  docker compose
  --project-directory "$APP_DIR"
  -f "$APP_DIR/compose.yml"
  -f "$APP_DIR/compose.prod.yml"
  --env-file "$ENV_PATH"
)
ROLLBACK_COMPOSE=()

restore_release() {
  local service
  local rollback_tag

  set +e
  echo "Restoring the previous production release." >&2

  if [ "$config_staged" = "true" ]; then
    for file in "${release_files[@]}"; do
      if [ -f "$rollback_dir/$file" ]; then
        cp -p "$rollback_dir/$file" "$APP_DIR/$file"
      fi
    done
  fi

  if [ -f "$rollback_dir/compose.yml" ] && [ -f "$rollback_dir/compose.prod.yml" ]; then
    ROLLBACK_COMPOSE=(
      docker compose
      --project-directory "$APP_DIR"
      -f "$rollback_dir/compose.yml"
      -f "$rollback_dir/compose.prod.yml"
      --env-file "$ENV_PATH"
    )

    for service in socket api; do
      rollback_tag="${rollback_tags[$service]-}"
      if [ -n "$rollback_tag" ]; then
        APP_IMAGE_TAG="$rollback_tag" "${ROLLBACK_COMPOSE[@]}" up -d --no-deps \
          --force-recreate --wait --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" "$service"
      fi
    done

    "${ROLLBACK_COMPOSE[@]}" up -d --no-deps --force-recreate --wait \
      --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" nginx
  fi
}

cleanup() {
  local status=$?

  if [ "$status" -ne 0 ] && [ "$deployment_complete" != "true" ]; then
    restore_release || true
  fi
  rm -rf -- "$rollback_dir"
  exit "$status"
}
trap cleanup EXIT

for file in "${release_files[@]}"; do
  if [ -f "$APP_DIR/$file" ]; then
    cp -p "$APP_DIR/$file" "$rollback_dir/$file"
  fi
done

deploy_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
for service in socket api; do
  container_id="$("${COMPOSE[@]}" ps -q "$service" 2> /dev/null || true)"
  if [ -n "$container_id" ]; then
    image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
    rollback_tag="rollback-$service-${SOURCE_SHA:0:12}-$deploy_id"
    docker image tag "$image_id" "letscube-app:$rollback_tag"
    rollback_tags["$service"]="$rollback_tag"
  fi
done

for file in "${release_files[@]}"; do
  install -m 0644 "$RELEASE_DIR/$file" "$APP_DIR/$file.new"
  mv "$APP_DIR/$file.new" "$APP_DIR/$file"
done
install -m 0755 "$RELEASE_DIR/check-production-health.sh" \
  "$APP_DIR/scripts/check-production-health.sh"
install -m 0755 "$RELEASE_DIR/repair-production-services.sh" \
  "$APP_DIR/scripts/repair-production-services.sh"
config_staged=true

export APP_IMAGE_TAG="$SOURCE_SHA"
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d --wait --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" postgres redis
"${COMPOSE[@]}" run --rm --no-deps migrate

# Socket.IO is replaced first so it accepts the browser client in the new API image.
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait \
  --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" socket
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait \
  --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" api
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait \
  --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" nginx

APP_DIR="$APP_DIR" ENV_FILE="$ENV_FILE" \
  "$RELEASE_DIR/check-production-health.sh"

printf '%s\n' "$SOURCE_SHA" > "$APP_DIR/.last-successful-deploy"
deployment_complete=true
echo "Deployment complete: all services use release $SOURCE_SHA."
"${COMPOSE[@]}" ps

docker image prune -af --filter "until=168h" || \
  echo "Deployment succeeded, but unused image cleanup failed." >&2
