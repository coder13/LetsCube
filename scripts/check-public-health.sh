#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PRODUCTION_BASE_URL:-https://letscube.net}"
CURL=(
  curl
  --fail
  --silent
  --show-error
  --location
  --connect-timeout 10
  --max-time 20
  --retry 2
  --retry-delay 2
  --retry-connrefused
)

"${CURL[@]}" --output /dev/null "$BASE_URL/"

verify_health() {
  local path="$1"
  local service="$2"
  local response

  response="$("${CURL[@]}" "$BASE_URL$path")"
  if ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<< "$response" \
    || ! grep -Eq "\"service\"[[:space:]]*:[[:space:]]*\"$service\"" <<< "$response"; then
    echo "Unexpected health response from $path" >&2
    return 1
  fi
}

verify_health /health/api api
verify_health /health/socket socket

echo "The public production routes are healthy."
