#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RENDERED_CONFIG="$(mktemp "${TMPDIR:-/tmp}/letscube-compose-config.XXXXXX")"

cleanup() {
  rm -f -- "$RENDERED_CONFIG"
}

trap cleanup EXIT

cd "$REPOSITORY_ROOT"

METRICS_ENABLED=false \
METRICS_RETENTION_DAYS=28 \
METRICS_HASH_SECRET=compose-metrics-test-value \
  docker compose --env-file .env.example -f compose.yml -f compose.prod.yml \
  config --format json > "$RENDERED_CONFIG"

jq -e \
  --arg enabled false \
  --arg retentionDays 28 \
  --arg hashSecret compose-metrics-test-value \
  '
    [.services.api.environment, .services.socket.environment]
    | all(
        .METRICS_ENABLED == $enabled
        and .METRICS_RETENTION_DAYS == $retentionDays
        and .METRICS_HASH_SECRET == $hashSecret
      )
  ' "$RENDERED_CONFIG" > /dev/null

echo "Production metrics Compose configuration checks passed."
