#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/www/letscube}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"
AUTO_STASH="${AUTO_STASH:-0}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
LOCK_FILE="${LOCK_FILE:-/tmp/letscube-production-update.lock}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another production update is already running."
  exit 0
fi

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

remote_ref="$REMOTE/$BRANCH"
if [ "$FORCE_DEPLOY" != "1" ] && git merge-base --is-ancestor "$remote_ref" HEAD; then
  echo "Already up to date."
  exit 0
fi

git merge --no-edit "$remote_ref"

after="$(git rev-parse HEAD)"
changed_files="$(git diff --name-only "$before" "$after" || true)"

echo "Updated from $before to $after."

cd "$APP_DIR/client"

if echo "$changed_files" | grep -q '^client/package'; then
  npm ci --no-audit || npm install --no-audit
fi

npm run build

if echo "$changed_files" | grep -q '^server/package'; then
  cd "$APP_DIR/server"
  npm ci --only=production --no-audit || npm install --production --no-audit
fi

cd "$APP_DIR/server"
pm2 reload ecosystem.config.js --env prod
pm2 status
