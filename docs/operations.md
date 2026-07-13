# Production Operations

This guide covers the Docker Compose production stack on a single VPS. Run
state-changing commands only when the deployment or maintenance action has been
explicitly authorized.

## Production Stack

The production stack combines `compose.yml` and `compose.prod.yml`:

| Service | Role |
| --- | --- |
| `api` | Express API and static client on port 8080 inside Compose |
| `socket` | Socket.IO on port 9000 inside Compose |
| `mongo` | Primary application database and session store |
| `postgres` | Optional dual-write and analytics database |
| `redis` | Socket.IO adapter and cross-instance coordination |
| `nginx` | TLS termination and public reverse proxy |

API and Socket.IO run the same `letscube-app` image with separate commands.
Production images are tagged with the full deployed commit SHA.

## Environment And Host Prerequisites

The host needs Docker Engine, Docker Compose, Git, the repository checkout, and
TLS certificates. Copy `.env.example` to an untracked `.env.prod`, replace every
placeholder, and restrict its permissions.

Required secrets include:

- `AUTH_SECRET`;
- `WCA_CLIENT_ID` and `WCA_CLIENT_SECRET`;
- `REACT_APP_WCA_CLIENT_ID` for the browser build; and
- `POSTGRES_PASSWORD` when PostgreSQL is enabled.

Production TLS mounts default to `/etc/letsencrypt`, with nginx expecting the
certificate for `www.letscube.net`. MongoDB, PostgreSQL, and Redis should remain
internal to the Compose network.

Do not assume a checkout path from an example or an old server. Determine the
active Compose project directory and pass it as `APP_DIR`.

## Preflight

Before deploying:

1. Confirm the intended Docker context and clear stale `DOCKER_HOST` values.
2. Confirm the checkout is owned by the deployment account and has no local
   changes.
3. Fetch the target branch and record the current and target commit SHAs.
4. Check free disk space and Docker usage.
5. Record current container status, image IDs, restart counts, and public health.

Typical read-only checks:

```sh
git status --short
git rev-parse HEAD
git rev-parse origin/master
df -h /
docker system df
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod ps
curl -fsS https://letscube.net/health/api
curl -fsS https://letscube.net/health/socket
```

## Deploying

Use `scripts/deploy.sh` for the Docker production stack:

```sh
APP_DIR=/path/to/active/checkout \
  ENV_FILE=.env.prod \
  scripts/deploy.sh
```

The default `DEPLOY_TARGET=auto` classifies the files changed since the previous
commit:

| Changed paths | Target |
| --- | --- |
| Documentation, CI, or agent metadata only | `none` |
| Browser client only | `api` |
| Server, shared protocol, dependencies, containers, deployment, or unknown | `all` |

Override only when the runtime impact is known:

```sh
DEPLOY_TARGET=api APP_DIR=/path/to/checkout scripts/deploy.sh
DEPLOY_TARGET=socket APP_DIR=/path/to/checkout scripts/deploy.sh
DEPLOY_TARGET=all APP_DIR=/path/to/checkout scripts/deploy.sh
DEPLOY_TARGET=none APP_DIR=/path/to/checkout scripts/deploy.sh
```

`DEPLOY_FORCE=true` rebuilds both application services at the current commit.
`DEPLOY_WAIT_TIMEOUT_SECONDS` changes the default 60-second readiness deadline.

The deploy script:

1. fetches and fast-forwards the configured branch;
2. builds one immutable application image;
3. starts backing services without recreating them;
4. applies committed PostgreSQL migrations;
5. snapshots the current image for every selected application service;
6. replaces and health-checks Socket.IO before API when both are selected; and
7. reloads nginx after each replacement.

Socket.IO is deployed first so a backward-compatible server is available before
the new browser bundle is served. Shared protocol changes must support this
brief mixed-version window.

`scripts/update-production.sh` is the older PM2-oriented updater. It is not the
canonical path for the Docker Compose stack.

## Failed Deployments And Rollback

A build, backing-service, or migration failure occurs before application
containers are replaced. If replacement readiness or nginx reload fails,
`scripts/deploy.sh` restores every attempted application service in reverse
order from its exact pre-deploy image and Compose definition, then reloads
nginx.

The Git checkout remains at the fetched commit after failure. Correct the cause
and rerun with the explicit target printed by the script.

Database migrations are not rolled back automatically. Every production
migration must remain compatible with the previous application image.

The deploy script can be tested without production access:

```sh
scripts/test-deploy-classifier.sh
scripts/test-deploy.sh
scripts/classify-deploy-target.sh client/src/components/App.jsx
```

## Verification And Monitoring

After deployment, verify:

- the checkout exactly matches the intended `origin/master` commit;
- selected containers use that commit's image and have zero unexpected restarts;
- all Compose services are healthy;
- `/health/api` and `/health/socket` succeed publicly;
- a real Socket.IO connection completes; and
- recent API, socket, nginx, and migration logs contain no new errors.

Useful commands:

```sh
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod ps
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs --tail=200 api
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs --tail=200 socket
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod logs --tail=200 nginx
```

`/health/api` requires MongoDB and treats PostgreSQL as optional.
`/health/socket` requires MongoDB and Redis and treats PostgreSQL as optional. An
optional PostgreSQL failure returns HTTP 200 with status `degraded`; a required
dependency failure returns HTTP 503 with status `error`.

The default Socket.IO namespace also supports `health_check`, returning a health
report through its acknowledgement or a `health_status` event.

## Backups

Create a MongoDB backup with an explicit checkout and destination:

```sh
APP_DIR=/path/to/checkout \
  BACKUP_DIR=/path/to/backups \
  scripts/backup-mongo.sh
```

The script creates gzip archives and retains 7 daily, 4 weekly, and 3 monthly
local backups. Set `BACKUP_S3_URI` and the documented AWS-compatible variables
to copy new archives off-server.

Backups are only useful if restore is tested periodically against non-production
data. Monitor backup age, size, and off-server upload failures.

## Restore

Restore is destructive: `mongorestore --drop` replaces matching collections in
the target database. Verify the archive, target URI, and current backup before
continuing.

```sh
APP_DIR=/path/to/checkout \
  scripts/restore-mongo.sh /path/to/letscube-mongo-backup.archive.gz
```

The script requires typing `RESTORE`. Never test restore against the production
database.

## Disk And Log Retention

Keep enough free space for a cold application image build as well as current and
rollback images. On the current small VPS class, 8–10 GB free is a practical
operating target; investigate at roughly 75% filesystem use and treat 85% as
critical.

Inspect before deleting:

```sh
df -h /
docker system df -v
journalctl --disk-usage
du -sh /path/to/backups
```

Safe retention principles:

- keep the current image and at least two known-good rollback revisions;
- prune old unused build cache and dangling images, not in-use images;
- configure bounded Docker and systemd-journal retention;
- keep backup retention explicit; and
- never prune Docker volumes as routine cleanup.

See the backup scripts before changing retention paths or schedules. Cron and
other host automation are external state; inspect the deployed account's actual
crontab rather than assuming the repository documents its current schedule.

## Moving To A New VPS

1. Snapshot the old VPS and take a fresh off-server MongoDB backup.
2. Provision Docker Engine and Compose on the new host.
3. Clone the repository and create a fresh `.env.prod`.
4. Install or copy TLS certificates securely.
5. Start MongoDB, PostgreSQL, and Redis.
6. Restore MongoDB and apply PostgreSQL migrations.
7. Start API, Socket.IO, and nginx.
8. Test login, room creation/join, timing, reconnect, health, backups, and
   restore against non-production data.
9. Confirm data services are not publicly reachable.
10. Move DNS and retain the old VPS until the new stack is stable.
