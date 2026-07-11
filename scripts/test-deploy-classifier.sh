#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFIER="$SCRIPT_DIR/classify-deploy-target.sh"

assert_target() {
  local expected="$1"
  shift

  local actual
  actual="$(bash "$CLASSIFIER" "$@")"
  if [ "$actual" != "$expected" ]; then
    echo "Expected '$expected' for: $*" >&2
    echo "Got '$actual'" >&2
    exit 1
  fi
}

assert_target none
assert_target none README.md docs/operations.md .github/workflows/ci.yml
assert_target api client/src/App.jsx client/src/styles.css
assert_target all client/src/lib/protocol.js
assert_target all client/src/lib/protocol.json
assert_target all client/src/lib/events.json
assert_target all server/socket/index.js
assert_target all yarn.lock
assert_target all client/src/App.jsx compose.yml
assert_target all unknown-runtime-file

echo "Deploy target classifier checks passed."
