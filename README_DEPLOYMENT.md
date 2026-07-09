# LetsCube Deployment

This repo supports running LetsCube with Docker Compose on one VPS. The intended production stack is `api`, `socket`, `mongo`, `redis`, and `nginx`.

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
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod up -d --build
```

The nginx container listens on ports `80` and `443`, proxies `/socket.io/` to `socket:9000`, and proxies everything else to `api:8080`. MongoDB and Redis are internal only.

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
8. Start MongoDB and Redis containers.
9. Restore MongoDB from the production backup.
10. Start the full production stack.
11. Test frontend loading, login, room create/join, race/session flows, Redis-backed socket behavior, backups, and restore on non-production data.
12. Confirm MongoDB and Redis are not publicly reachable.
13. Point DNS at the new VPS.
14. Keep the old VPS available for rollback until the new stack has been stable.
