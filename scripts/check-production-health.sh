#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube/runtime}"
ENV_FILE="${ENV_FILE:-/home/www/letscube/.env.prod}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-10}"
HEALTH_RETRY_SECONDS="${HEALTH_RETRY_SECONDS:-3}"

if ! [[ "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "HEALTH_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

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
services=(postgres redis socket api nginx)

for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1)); do
  failed=()

  for service in "${services[@]}"; do
    container_id="$("${COMPOSE[@]}" ps --status running -q "$service")"
    if [ -z "$container_id" ]; then
      failed+=("$service:missing")
      continue
    fi

    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id")"
    if [ "$health_status" != "healthy" ]; then
      failed+=("$service:$health_status")
    fi
  done

  if [ "${#failed[@]}" -eq 0 ]; then
    echo "All production services are healthy."
    exit 0
  fi

  echo "Health check $attempt/$HEALTH_ATTEMPTS failed: ${failed[*]}" >&2
  if [ "$attempt" -lt "$HEALTH_ATTEMPTS" ]; then
    sleep "$HEALTH_RETRY_SECONDS"
  fi
done

"${COMPOSE[@]}" ps >&2 || true
"${COMPOSE[@]}" logs --tail=120 api socket postgres redis nginx >&2 || true
exit 1
