#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube/runtime}"
ENV_FILE="${ENV_FILE:-/home/www/letscube/.env.prod}"
DEPLOY_WAIT_TIMEOUT_SECONDS="${DEPLOY_WAIT_TIMEOUT_SECONDS:-90}"
LOCK_FILE="${LOCK_FILE:-/tmp/letscube-deploy.lock}"

if [[ "$ENV_FILE" = /* ]]; then
  ENV_PATH="$ENV_FILE"
else
  ENV_PATH="$APP_DIR/$ENV_FILE"
fi

COMPOSE=(
  docker compose
  --project-directory "$APP_DIR"
  -f "$APP_DIR/compose.yml"
  -f "$APP_DIR/compose.prod.yml"
  --env-file "$ENV_PATH"
)

exec 9> "$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

release_file="$APP_DIR/.last-successful-deploy"
if [ ! -f "$release_file" ]; then
  echo "Cannot repair production before the first successful image deployment." >&2
  exit 1
fi

source_sha="$(tr -d '[:space:]' < "$release_file")"
if ! [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release in $release_file" >&2
  exit 1
fi

image="letscube-app:$source_sha"
image_source="$(docker image inspect \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")"
if [ "$image_source" != "$source_sha" ]; then
  echo "Release image $image does not match its source label." >&2
  exit 1
fi

service_health() {
  local service="$1"
  local container_id

  container_id="$("${COMPOSE[@]}" ps --status running -q "$service")"
  if [ -z "$container_id" ]; then
    printf 'missing\n'
    return
  fi

  docker inspect \
    --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
    "$container_id"
}

services=(postgres redis socket api nginx)
unhealthy=()
for service in "${services[@]}"; do
  status="$(service_health "$service")"
  if [ "$status" != healthy ]; then
    unhealthy+=("$service:$status")
  fi
done

if [ "${#unhealthy[@]}" -eq 0 ]; then
  exit 0
fi

echo "Repairing unhealthy production services: ${unhealthy[*]}"
export APP_IMAGE_TAG="$source_sha"
"${COMPOSE[@]}" config --quiet

for service in "${services[@]}"; do
  if [ "$(service_health "$service")" = healthy ]; then
    continue
  fi

  "${COMPOSE[@]}" up -d --no-deps --force-recreate --wait \
    --wait-timeout "$DEPLOY_WAIT_TIMEOUT_SECONDS" "$service"
done

APP_DIR="$APP_DIR" ENV_FILE="$ENV_FILE" \
  "$APP_DIR/scripts/check-production-health.sh"
