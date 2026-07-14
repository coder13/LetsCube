#!/usr/bin/env bash
set -euo pipefail

TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/letscube-mongo-live-rehearsal.XXXXXX")"
NETWORK="letscube-mongo-rehearsal-$RANDOM-$$"
SOURCE="${NETWORK}-source"
TARGET="${NETWORK}-target"
ARCHIVE="$TEST_ROOT/backup.archive.gz"

cleanup() {
  docker rm -f "$SOURCE" "$TARGET" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf -- "$TEST_ROOT"
}

trap cleanup EXIT

wait_for_mongo() {
  local container="$1"
  local attempt

  for attempt in {1..30}; do
    if docker exec "$container" mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' \
      | grep -qx '1'; then
      return
    fi

    sleep 1
  done

  echo "MongoDB did not become ready: $container" >&2
  docker logs "$container" >&2 || true
  exit 1
}

docker network create "$NETWORK" >/dev/null
docker run -d --rm --name "$SOURCE" --network "$NETWORK" mongo:7.0 >/dev/null
docker run -d --rm --name "$TARGET" --network "$NETWORK" mongo:7.0 >/dev/null

wait_for_mongo "$SOURCE"
wait_for_mongo "$TARGET"

docker exec "$SOURCE" mongosh rehearsal --quiet --eval \
  'db.attempts.insertOne({ ordinal: 1, scramble: "synthetic", solveMs: 12345 })' >/dev/null
docker exec "$TARGET" mongosh rehearsal --quiet --eval \
  'db.attempts.insertOne({ stale: true })' >/dev/null

docker exec "$SOURCE" mongodump \
  --uri 'mongodb://localhost:27017/rehearsal' \
  --archive --gzip > "$ARCHIVE"
docker exec -i "$TARGET" mongorestore \
  --uri 'mongodb://localhost:27017/rehearsal' \
  --drop --archive --gzip < "$ARCHIVE"

record_count="$(docker exec "$TARGET" mongosh rehearsal --quiet --eval 'db.attempts.countDocuments({})')"
scramble="$(docker exec "$TARGET" mongosh rehearsal --quiet --eval 'db.attempts.findOne().scramble')"

if [ "$record_count" != '1' ] || [ "$scramble" != 'synthetic' ]; then
  echo 'MongoDB backup/restore rehearsal did not preserve the synthetic attempt.' >&2
  exit 1
fi

echo 'Live MongoDB backup and restore rehearsal passed.'
