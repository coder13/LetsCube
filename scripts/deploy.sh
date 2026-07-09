#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"
DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-ff-only}"
DEPLOY_FORCE="${DEPLOY_FORCE:-false}"

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")

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
if [ "$previous_commit" = "$current_commit" ] && [ "$DEPLOY_FORCE" != "true" ]; then
  echo "Already up to date at $current_commit"
  "${COMPOSE[@]}" ps
  exit 0
fi

if ! "${COMPOSE[@]}" up -d --build; then
  echo "Deployment failed. Recent service logs:" >&2
  "${COMPOSE[@]}" logs --tail=120 api socket nginx >&2 || true
  exit 1
fi

"${COMPOSE[@]}" ps
