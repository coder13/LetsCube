#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORKFLOW="$ROOT_DIR/.github/workflows/deploy.yml"
IMAGE_DEPLOY="$SCRIPT_DIR/deploy-image-release.sh"
HEALTH_CHECK="$SCRIPT_DIR/check-production-health.sh"

assert_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq -- "$expected" "$file"; then
    echo "$file must contain: $expected" >&2
    exit 1
  fi
}

assert_contains "$WORKFLOW" 'workflows: [CI]'
assert_contains "$WORKFLOW" 'branches: [master]'
assert_contains "$WORKFLOW" "github.event.workflow_run.conclusion == 'success'"
assert_contains "$WORKFLOW" 'IMAGE_TAG="${IMAGE_REPOSITORY,,}:$SOURCE_SHA"'
assert_contains "$WORKFLOW" 'IMAGE_REPOSITORY="${IMAGE_REPOSITORY,,}"'
assert_contains "$WORKFLOW" 'image_ref=$IMAGE_REPOSITORY@$IMAGE_DIGEST'
assert_contains "$WORKFLOW" 'for attempt in 1 2 3; do'
assert_contains "$WORKFLOW" '--cache-to type=gha,mode=max,scope=production-image'
assert_contains "$WORKFLOW" 'Image build attempt $attempt failed.'
assert_contains "$WORKFLOW" 'Image transfer attempt $attempt failed.'
assert_contains "$WORKFLOW" 'docker save "letscube-app:$SOURCE_SHA"'
assert_contains "$WORKFLOW" 'scripts/deploy-image-release.sh scripts/check-production-health.sh'
assert_contains "$WORKFLOW" 'scripts/repair-production-services.sh'
assert_contains "$WORKFLOW" 'scripts/disable-legacy-deploy-cron.sh'
assert_contains "$WORKFLOW" 'APP_DIR: /opt/letscube/runtime'
assert_contains "$WORKFLOW" 'ENV_FILE: /home/www/letscube/.env.prod'

assert_contains "$IMAGE_DEPLOY" 'docker image inspect "$image"'
assert_contains "$IMAGE_DEPLOY" 'org.opencontainers.image.revision'
assert_contains "$IMAGE_DEPLOY" 'run --rm --no-deps migrate'
assert_contains "$IMAGE_DEPLOY" 'printf '\''%s\n'\'' "$SOURCE_SHA" > "$APP_DIR/.last-successful-deploy"'
assert_contains "$HEALTH_CHECK" 'services=(postgres redis socket api nginx)'

if grep -Eq 'git (pull|fetch|merge)' "$IMAGE_DEPLOY"; then
  echo 'Image deployment must not update a production Git checkout.' >&2
  exit 1
fi

bash -n "$IMAGE_DEPLOY" "$HEALTH_CHECK"
echo 'GitHub Actions deployment checks passed.'
