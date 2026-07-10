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

if ! "${COMPOSE[@]}" build api; then
  echo "Application image build failed." >&2
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --no-recreate mongo postgres redis; then
  echo "Failed to start backing services." >&2
  exit 1
fi

if ! "${COMPOSE[@]}" run --rm --no-deps migrate; then
  echo "PostgreSQL migration failed; application containers were not replaced." >&2
  exit 1
fi

# Replace one application process at a time. API sessions live in MongoDB, and
# socket room membership is preserved during the configured reconnect grace.
if ! "${COMPOSE[@]}" up -d --no-deps --wait api; then
  echo "API deployment failed. Recent API logs:" >&2
  "${COMPOSE[@]}" logs --tail=120 api >&2 || true
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --no-deps --wait nginx \
  || ! "${COMPOSE[@]}" exec -T nginx nginx -s reload; then
  echo "Failed to reload nginx after the API deployment." >&2
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --no-deps --wait socket; then
  echo "Socket deployment failed. Recent socket logs:" >&2
  "${COMPOSE[@]}" logs --tail=120 socket >&2 || true
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --no-deps --wait nginx \
  || ! "${COMPOSE[@]}" exec -T nginx nginx -s reload; then
  echo "Failed to reload nginx after the socket deployment. Recent service logs:" >&2
  "${COMPOSE[@]}" logs --tail=120 api socket nginx >&2 || true
  exit 1
fi

"${COMPOSE[@]}" ps
