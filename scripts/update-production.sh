#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/www/letscube}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"
AUTO_STASH="${AUTO_STASH:-0}"

cd "$APP_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  if [ "$AUTO_STASH" = "1" ]; then
    git stash push --include-untracked -m "deploy-autostash $(date -u +%Y%m%dT%H%M%SZ)"
  else
    echo "Refusing to deploy with local changes. Re-run with AUTO_STASH=1 to stash them first." >&2
    git status --short
    exit 1
  fi
fi

before="$(git rev-parse HEAD)"

git fetch "$REMOTE" "$BRANCH"
git merge --no-edit "$REMOTE/$BRANCH"

after="$(git rev-parse HEAD)"
changed_files="$(git diff --name-only "$before" "$after" || true)"

if [ "$before" = "$after" ]; then
  echo "Already up to date."
else
  echo "Updated from $before to $after."
fi

if echo "$changed_files" | grep -q '^client/'; then
  cd "$APP_DIR/client"

  if echo "$changed_files" | grep -q '^client/package'; then
    npm ci --no-audit || npm install --no-audit
  fi

  npm run build
fi

if echo "$changed_files" | grep -q '^server/package'; then
  cd "$APP_DIR/server"
  npm ci --only=production --no-audit || npm install --production --no-audit
fi

cd "$APP_DIR/server"
pm2 reload ecosystem.config.js --env prod
pm2 status
