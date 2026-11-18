#!/usr/bin/env bash
set -euo pipefail

case "$(basename -- "$0")" in
  curl)
    url="${!#}"
    printf '%s\n' "$url" >> "$PUBLIC_HEALTH_TEST_LOG"
    if [ "${PUBLIC_HEALTH_FAIL_PATH:-}" != "" ] \
      && [[ "$url" == *"$PUBLIC_HEALTH_FAIL_PATH" ]]; then
      exit 22
    fi
    case "$url" in
      */health/api)
        printf '{"status":"ok","service":"api"}\n'
        ;;
      */health/socket)
        printf '{"status":"ok","service":"socket"}\n'
        ;;
    esac
    exit 0
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-public-health.XXXXXX")"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

PUBLIC_HEALTH_TEST_LOG="$TEST_ROOT/curl.log"
mkdir -p "$TEST_ROOT/bin"
ln -s "$SCRIPT_DIR/test-public-health.sh" "$TEST_ROOT/bin/curl"

PATH="$TEST_ROOT/bin:$PATH" \
  PUBLIC_HEALTH_TEST_LOG="$PUBLIC_HEALTH_TEST_LOG" \
  PRODUCTION_BASE_URL=https://example.test \
  "$SCRIPT_DIR/check-public-health.sh" > /dev/null

for path in / /health/api /health/socket; do
  if ! grep -Fqx "https://example.test$path" "$PUBLIC_HEALTH_TEST_LOG"; then
    echo "The public health test did not request $path." >&2
    exit 1
  fi
done

if PATH="$TEST_ROOT/bin:$PATH" \
  PUBLIC_HEALTH_TEST_LOG="$PUBLIC_HEALTH_TEST_LOG" \
  PUBLIC_HEALTH_FAIL_PATH=/health/socket \
  PRODUCTION_BASE_URL=https://example.test \
  "$SCRIPT_DIR/check-public-health.sh" > /dev/null 2>&1; then
  echo "The public health test accepted an unavailable socket service." >&2
  exit 1
fi

echo "Public production health checks passed."
