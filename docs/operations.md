# Production Operations

The production stack is `api`, `socket`, `postgres`, `redis`, and `nginx`.
PostgreSQL is the durable source of truth and session store; Redis is ephemeral
coordination and rate limiting. MongoDB is used only by the one-time cutover
backfill tool.

## Deployment

Use the Compose deploy script from the active checkout:

```sh
APP_DIR=/opt/letscube ENV_FILE=.env.prod scripts/deploy.sh
```

The script builds an immutable image, starts PostgreSQL and Redis, applies
committed Prisma migrations, then replaces and health-checks Socket.IO and the
API. It does not start or depend on MongoDB.

Before a big-bang cutover, take a PostgreSQL backup and run the MongoDB
backfill tool during a maintenance window:

```sh
yarn workspace letscube-server postgres:migrate
yarn workspace letscube-server postgres:migrate-from-mongo
MONGO_URL='mongodb://old-source/letscube' \
  yarn workspace letscube-server postgres:migrate-from-mongo --apply
```

The backfill is migration-only. It copies durable records and deliberately does
not copy sessions or OAuth tokens; users authenticate again after cutover.

## Health and verification

```sh
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod ps
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs --tail=200 api socket postgres
curl -fsS https://letscube.net/health/api
curl -fsS https://letscube.net/health/socket
```

Both health endpoints require PostgreSQL. The socket endpoint also requires
Redis. A failed required dependency returns HTTP 503.

## Backups and restore

Create a PostgreSQL custom-format backup and test restores against a separate
database:

```sh
BACKUP_DIR=/opt/letscube/backups
mkdir -p "$BACKUP_DIR"
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc \
  > "$BACKUP_DIR/letscube-postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

```sh
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_restore -U "$PGUSER" -d "$PGDATABASE" \
  --clean --if-exists < /path/to/letscube-postgres.dump
```

Keep backups encrypted and off-host according to the hosting policy. Never
restore destructively over production without an explicit maintenance approval.

## Recovery

Application images may be rolled back, but Prisma migrations are not reversed by
the deploy script. Keep migrations backward-compatible with the immediately
previous image and verify the database backup before rollback. Do not prune
PostgreSQL or Redis volumes as routine cleanup.
