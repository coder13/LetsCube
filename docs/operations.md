# Production Operations

The production stack is `api`, `socket`, `postgres`, `redis`, and `nginx`.
PostgreSQL is the durable source of truth and session store; Redis is ephemeral
coordination and rate limiting. MongoDB is used only by the one-time cutover
backfill tool.

## Deployment

Production deploys run through the `Production deploy` GitHub Actions workflow.
The workflow starts after a successful `CI` run on `master`. It performs these
steps:

1. Build one application image from the exact `master` commit.
2. Push the image to GHCR and retain its immutable digest.
3. Transfer that exact image and the production Compose files to the server.
4. Apply migrations, replace Socket.IO before the API, and verify all five
   production services.
5. Retry image builds, transfers, and activation up to three times. Each failed
   activation restores the previous application images and Compose files before
   the next attempt.

The server does not fetch or merge Git commits during this process. A manual
workflow run can deploy a specific commit, branch, or tag. The workflow uses the
GitHub `production` environment, so configure its approval policy to match the
release policy.

The repository needs these GitHub Actions secrets:

- `SERVER_IP`: the production server address.
- `DEPLOY_SSH_KEY`: the private key for the `www` account.
- `DEPLOY_KNOWN_HOSTS`: the pinned SSH host key entry.

The server needs Docker access for `www`, the production `.env.prod` file at
`/home/www/letscube`, and the existing certificate directories. Actions stores
runtime Compose files in `/opt/letscube/runtime`, outside the old Git checkout.
After the first successful image activation, it removes only the old
`scripts/deploy.sh` cron entry. It saves the prior crontab at
`/opt/letscube/legacy-deploy-crontab.backup`. The PostgreSQL backup cron remains
active. A replacement cron checks all five services every ten minutes. It
recreates only missing or unhealthy services from the last successful image.
It does not fetch source code.

The checkout-based script remains available as a temporary recovery path:

```sh
APP_DIR=/home/www/letscube ENV_FILE=.env.prod scripts/deploy.sh
```

It records the last successful commit separately from the checkout. A failed
deployment therefore retries on the next run even when Git already moved to the
new commit. It also treats a missing or unhealthy PostgreSQL, Redis, Socket.IO,
API, or nginx container as a full repair deployment.

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
APP_DIR=/opt/letscube/runtime \
  ENV_FILE=/home/www/letscube/.env.prod \
  /opt/letscube/runtime/scripts/check-production-health.sh
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs --tail=200 api socket postgres
curl -fsS https://letscube.net/health/api
curl -fsS https://letscube.net/health/socket
```

Both health endpoints require PostgreSQL. The socket endpoint also requires
Redis. A failed required dependency returns HTTP 503.

nginx also has a container health check. It calls the API health route through
the local TLS listener. This detects a broken proxy configuration and an
unavailable API upstream.

The `Production health monitor` GitHub Actions workflow checks the homepage and
both health endpoints every five minutes. It opens one `production-health`
issue during an outage. It closes that issue after the public routes recover.
This external check still runs when the production host or its network fails.

API and Socket.IO containers allow 30 seconds for a clean stop. On `SIGTERM` or
`SIGINT`, they stop accepting connections and close their PostgreSQL and Redis
clients before they exit. The Socket.IO process also closes its active sockets.
This keeps rolling deployments from cutting off work in the middle of cleanup.

The Cypress CI job restarts both Node services during browser tests. It verifies
that an API restart keeps the PostgreSQL-backed login session and that a browser
in a room reconnects after a Socket.IO restart.

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
