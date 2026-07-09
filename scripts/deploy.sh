#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/letscube}"
ENV_FILE="${ENV_FILE:-.env.prod}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"

COMPOSE=(docker compose -f compose.yml -f compose.prod.yml --env-file "$ENV_FILE")

cd "$APP_DIR"

git fetch "$REMOTE" "$BRANCH"
git merge --ff-only "$REMOTE/$BRANCH"

if ! "${COMPOSE[@]}" up -d --build; then
  echo "Deployment failed. Recent service logs:" >&2
  "${COMPOSE[@]}" logs --tail=120 api socket nginx >&2 || true
  exit 1
fi

"${COMPOSE[@]}" ps
