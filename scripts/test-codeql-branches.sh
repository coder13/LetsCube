#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW="$SCRIPT_DIR/../.github/workflows/codeql.yml"

for branch in dev master; do
  if ! awk '
    /^  push:/ { in_push = 1; next }
    in_push && /^  [^[:space:]]/ { exit }
    in_push && $0 == "      - " branch { found = 1 }
    END { exit !found }
  ' branch="$branch" "$WORKFLOW"; then
    echo "CodeQL must run on pushes to $branch." >&2
    exit 1
  fi
done

echo "CodeQL push branch coverage checks passed."
