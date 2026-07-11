#!/usr/bin/env bash
set -euo pipefail

# Classify changed paths for scripts/deploy.sh. Paths may be passed as
# arguments or, for ad-hoc use, one per line on stdin.
if [ "$#" -eq 0 ] && [ ! -t 0 ]; then
  mapfile -t changed_paths
else
  changed_paths=("$@")
fi

target="none"

for path in "${changed_paths[@]}"; do
  case "$path" in
    # Repository documentation and CI/agent metadata do not affect runtime.
    .github/*|.agents/*|.codex/*|docs/*|AGENTS.md|README.md|README_*.md|LICENSE|LICENSE.*|*.md)
      ;;

    # The server imports this client-owned protocol file at runtime.
    client/src/lib/protocol.js|client/src/lib/protocol.json|client/src/lib/events.json)
      echo "all"
      exit 0
      ;;

    # The API image serves the built browser client. A client-only change does
    # not require interrupting existing Socket.IO connections.
    client/*)
      target="api"
      ;;

    # Server, dependency, container, deployment, and unknown changes are
    # intentionally conservative because API and socket share one image.
    *)
      echo "all"
      exit 0
      ;;
  esac
done

echo "$target"
