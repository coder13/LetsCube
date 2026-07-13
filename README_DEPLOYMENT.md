# LetsCube Deployment

This repo supports running LetsCube with Docker Compose on one VPS. The intended production stack is `api`, `socket`, `mongo`, `postgres`, `redis`, and `nginx`.

## Current Startup Audit

- The app currently has two Node entrypoints, not one: `server/index.js` for Express/API/static frontend on port `8080`, and `server/socket/index.js` for Socket.IO on port `9000`.
- The Express server serves `client/build` directly, so the production Docker image builds the React client and copies it next to the server code.
- PM2 is no longer needed in Docker. Compose runs `api` and `socket` as separate services with `restart: unless-stopped`.
- MongoDB was previously read from `server/config/*.json` as `mongodb://127.0.0.1/letscube`; containers should use `MONGO_URL=mongodb://mongo:27017/letscube`.
- Redis was previously hardcoded to `localhost:6379` in the socket process; it is now env-driven with `REDIS_URL=redis://redis:6379`.
- Required production secrets are `AUTH_SECRET`, `WCA_CLIENT_ID`, and `WCA_CLIENT_SECRET`. The client build also needs `REACT_APP_WCA_CLIENT_ID`.
- The target Node runtime is Node `22.17.0`, and the frontend is built with Vite.
- No separate background workers or queues were found. Redis is used by Socket.IO for coordination.

## Development

Create `.env.dev` from `.env.example`, then run:

```bash
docker compose -f compose.yml -f compose.dev.yml --env-file .env.dev up
```

Development ports:

- Client: `http://localhost:3000`
- API/static server: `http://localhost:8080`
- Socket.IO: `http://localhost:9000`
- MongoDB: `127.0.0.1:27017`
- Redis: `127.0.0.1:6379`

The dev override bind mounts the repo and keeps container `node_modules` in named volumes.

## Production

Create `.env.prod` from `.env.example` on the VPS and fill in real values:

```bash
cp .env.example .env.prod
```

Start or update production:

```bash
APP_IMAGE_TAG="$(git rev-parse HEAD)" \
  docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod up -d --build
```

Using the full commit SHA keeps manually deployed application images
immutable. `APP_IMAGE_TAG=local` remains available for direct development and
one-off Compose use. The deployment script always overrides `APP_IMAGE_TAG`
with the commit it checked out.

The nginx container listens on ports `80` and `443`, proxies `/socket.io/` to `socket:9000`, and proxies everything else to `api:8080`. MongoDB, PostgreSQL, and Redis are internal only.

TLS expects Let’s Encrypt files at:

```text
/etc/letsencrypt/live/www.letscube.net/fullchain.pem
/etc/letsencrypt/live/www.letscube.net/privkey.pem
```

Copy existing certs from the old VPS or issue new certs before starting nginx.

## Operations

View status:

```bash
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod ps
```

View logs:

```bash
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f api
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f socket
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f mongo
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f postgres
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f redis
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs -f nginx
```

Restart services:

```bash
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod restart api
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod restart socket
```

Deploy latest code from the server checkout:

```bash
APP_DIR=/opt/letscube scripts/deploy.sh
```

The default `DEPLOY_TARGET=auto` chooses the smallest safe application target:

| Changed paths | Resolved target |
| --- | --- |
| Documentation, CI, or agent metadata only | `none` |
| Browser client only | `api` (which also serves the static client) |
| Shared socket protocol, server, dependency, container, deployment, or unknown files | `all` |

Override the classifier when the intended runtime impact is known:

```bash
DEPLOY_TARGET=api APP_DIR=/opt/letscube scripts/deploy.sh
DEPLOY_TARGET=socket APP_DIR=/opt/letscube scripts/deploy.sh
DEPLOY_TARGET=all APP_DIR=/opt/letscube scripts/deploy.sh
DEPLOY_TARGET=none APP_DIR=/opt/letscube scripts/deploy.sh
```

Accepted values are `auto`, `api`, `socket`, `all`, and `none`. Explicit
targets are honored even when the checkout is already current. With `auto`, an
unchanged checkout exits without replacing healthy running containers. If API,
socket, or nginx is missing, `auto` bootstraps both application services;
`DEPLOY_FORCE=true` also rebuilds and replaces both at the current commit.
Readiness waits are capped at 60 seconds before automatic rollback; override
that bound with `DEPLOY_WAIT_TIMEOUT_SECONDS` when diagnosing unusually slow
startup.

You can verify the conservative path classifier without fetching code or
touching Docker:

```bash
scripts/test-deploy-classifier.sh
scripts/test-deploy.sh
scripts/classify-deploy-target.sh client/src/App.jsx
```

For any selected application target, the deploy script builds one shared image
tagged with the full commit SHA, waits for backing services without recreating
them, and applies PostgreSQL migrations before replacing application
containers. It snapshots the exact image ID of every selected running service,
then replaces and health-checks services one at a time. For `all`, socket rolls
out before API/static so the backward-compatible server is ready before the new
browser client is served. nginx is gracefully reloaded only after a selected
service changes, so it resolves the replacement container without dropping
unrelated connections. If nginx is not running during a bootstrap deploy, its
startup is deferred until the selected application services are ready.

If replacement readiness or the nginx reload fails, recent diagnostic logs are
printed and every application service attempted in that deploy is restored in
reverse order using its exact pre-deploy image and Compose configuration. nginx
is then reloaded again.
Rollback image tags are retained locally for manual recovery until normal image
cleanup. Database migrations are not automatically reversed, so migrations
must remain backward-compatible with the previous application image.

The checkout remains at the fetched commit after a failed deploy. Correct the
failure and rerun with the explicit target printed by the script; a later
`auto` run with no new commit otherwise treats the checkout as up to date.

Socket clients briefly reconnect only when `socket` is selected. Room
membership, the current scramble, waiting/competing state, and room admin are
preserved during `ROOM_RECONNECT_GRACE_MS` (60 seconds by default). A client
that reconnects within that window resumes the existing room without being
logically removed first. Only users with no socket on any Socket.IO instance
after the grace window are removed from the room.

An in-progress solve continues timing in the browser during that reconnect. If
the solve finishes before the socket is ready, the result is retained locally,
the next solve is blocked, and the saved result is submitted only after the
client rejoins the room. The local copy is cleared only after the server
acknowledges persistence, so a refresh or repeated reconnect does not discard
the time.

Set the grace window in `.env.prod` if production deploys or client reconnects
need more time:

```bash
ROOM_RECONNECT_GRACE_MS=90000
```

Keep the grace shorter than the time in which an abandoned room should appear
active. Explicit leaves, kicks, and bans remain immediate and do not use the
grace window.

Grand Prix is intentionally disabled in production:

```bash
GRAND_PRIX_ENABLED=false
```

Keep this setting disabled until the legacy scheduler is redesigned. Setting
it to `true` explicitly restores the old mode for development or controlled
testing.

## WCA Email Privacy Cutover

The privacy cutover is deliberately separate from ordinary database migrations.
PostgreSQL migrations run before a new application image is healthy, so using a
migration to purge data could let the automatic rollback restore an image that
writes the data again.

Perform the cutover in this order:

1. Deploy this release to both application services with `DEPLOY_TARGET=all`.
2. Confirm the API and socket health checks pass, the browser's WCA authorization
   request has exactly `scope=public`, and a new login succeeds.
3. From `/opt/letscube`, record the running safe commit as the rollback floor:

   ```bash
   git rev-parse HEAD | tee .privacy-email-cutover
   ```

   Future `scripts/deploy.sh` runs refuse any commit that does not descend from
   this floor. Do not use direct Compose commands or a saved image tag to restore
   an older release after creating the marker.
4. Run the purge from the newly deployed image:

   ```bash
   docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod run --rm --no-deps api node server/privacy/purgeUserEmails.js
   ```

   The command reports record counts only. It never prints field values and
   exits unsuccessfully if either database still has a value.
5. Run the same command a second time. Every matched, modified, cleared, and
   remaining count should be zero; this verifies that the operation is
   idempotent.
6. Create and verify a fresh post-cutover backup. Remove every pre-cutover local
   and remote backup according to the storage provider's secure deletion
   procedure; normal retention is not sufficient for historical private data.

If the initial deployment rolls back before step 3, do not create the marker or
run the purge. Correct the release and redeploy it first. After step 3, the
privacy-safe commit is the minimum supported rollback image.

The PostgreSQL `app.users.email` column remains temporarily as an always-empty
compatibility column. Current dual writes never send it a value and clear a
legacy value whenever they update an existing row. Removing the column is phase two:
first deploy an application release that no longer references the compatibility
column, advance every supported rollback image to that release, and only then
apply a migration that drops it. Do not combine that drop with this cutover.

### Health Checks

The API and socket processes expose dependency-aware health endpoints.
Unavailable MongoDB or Redis returns HTTP `503` with the failing check marked
`error`. PostgreSQL dual writes are optional, so a PostgreSQL outage returns
HTTP `200` with overall status `degraded` while the primary MongoDB/Redis path
remains ready.

```bash
curl -sS https://letscube.net/health/api
curl -sS https://letscube.net/health/socket
```

The default Socket.IO namespace also accepts a `health_check` event. It returns
the socket health report through the acknowledgment callback, or emits
`health_status` when no callback is provided. This tests a real Socket.IO
connection in addition to the HTTP readiness endpoint.

## Backups And Restore

Run a MongoDB backup:

```bash
APP_DIR=/opt/letscube BACKUP_DIR=/opt/letscube/backups scripts/backup-mongo.sh
```

The backup script creates timestamped gzip archives and keeps 7 daily, 4 weekly, and 3 monthly local backups. To upload off-server, configure `BACKUP_S3_URI` plus AWS or S3-compatible credentials in the environment.

Example cron:

```cron
15 3 * * * cd /opt/letscube && /opt/letscube/scripts/backup-mongo.sh >> /opt/letscube/logs/backup-mongo.log 2>&1
```

Restore from a backup:

```bash
APP_DIR=/opt/letscube scripts/restore-mongo.sh /opt/letscube/backups/letscube-mongo-daily-YYYYmmddTHHMMSSZ.archive.gz
```

The restore script requires typing `RESTORE` and uses `mongorestore --drop`.

## Migration To A New VPS

Do not upgrade the old VPS in place for this migration.

1. Snapshot the existing VPS.
2. Take a fresh MongoDB backup on the current server and copy it off-server.
3. Create a new VPS.
4. Install Docker Engine and the modern `docker compose` plugin.
5. Clone this repo to `/opt/letscube`.
6. Create `.env.prod` with production secrets and domains.
7. Copy or issue Let’s Encrypt certs for `letscube.net`.
8. Start MongoDB, PostgreSQL, and Redis containers.
9. Restore MongoDB from the production backup.
10. Start the full production stack.
11. Test frontend loading, login, room create/join, race/session flows, Redis-backed socket behavior, backups, and restore on non-production data.
12. Confirm MongoDB, PostgreSQL, and Redis are not publicly reachable.
13. Point DNS at the new VPS.
14. Keep the old VPS available for rollback until the new stack has been stable.
