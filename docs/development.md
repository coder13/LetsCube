# Development

## Prerequisites

- Node `22.17.0` (the version in `.nvmrc`)
- Yarn `1.22.22` through Corepack or a compatible local installation
- Docker Engine with Docker Compose

Install JavaScript dependencies from the repository root:

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
```

The root `yarn.lock` is authoritative. Do not install separately inside
`client/`, `server/`, or `packages/*`.

## Local Services With Host Node

The simplest workflow runs MongoDB, PostgreSQL, and Redis in Docker while the
three application processes run on the host:

```sh
docker compose -f docker-compose.yml up -d
yarn workspace letscube-server postgres:migrate
```

Service ports are bound to localhost:

| Service | Address |
| --- | --- |
| Client | `http://localhost:3000` |
| API | `http://localhost:8080` |
| Socket.IO | `http://localhost:9000` |
| MongoDB | `127.0.0.1:27017` |
| PostgreSQL | `127.0.0.1:55433` |
| Redis | `127.0.0.1:6379` |

Start the app in separate terminals:

```sh
yarn start:client
yarn start:server
yarn start:socket
```

Stop the backing services without deleting their data:

```sh
docker compose -f docker-compose.yml down
```

Do not add `--volumes` unless you intentionally want to delete all local
database and Redis data.

## Full Docker Development Stack

To run the application processes in containers, copy the environment template
and use the base Compose file with its development override:

```sh
cp .env.example .env.dev
docker compose -f compose.yml -f compose.dev.yml --env-file .env.dev up
```

The override bind-mounts the repository and stores each container's
`node_modules` in a named volume. Replace the example OAuth values in `.env.dev`
when testing a real WCA login.

## Environment Configuration

`server/runtimeConfig.js` combines `server/config/*.json` defaults with runtime
environment variables. Important groups are documented in `.env.example`:

- process ports and feature flags;
- public client build origins;
- MongoDB, Redis, and PostgreSQL connections;
- session and WCA OAuth secrets;
- CORS origins and metric retention; and
- production TLS and backup paths.

An otherwise disabled feature that opts into user targeting can be scoped to selected WCA users with
`FEATURE_<FLAG>_USER_IDS`, a comma-separated allowlist of numeric user IDs.
For example, `FEATURE_SOLVE_HISTORY_USER_IDS=8184` enables the solve-history
preview only for that signed-in user while its global production flag remains off.

`.env.example` is a template, not a file automatically sourced by host Node
processes. Compose only passes variables referenced in its service environment;
export any additional server override explicitly or add it to the relevant
Compose service.

The host development client reads `client/.env.development`. It targets the WCA
staging site and the standard local API/socket ports. Vite exposes the existing
`REACT_APP_*` names for compatibility with the client code.

Never put production secrets in a tracked environment file.

## Common Commands

From the repository root:

```sh
yarn start:client
yarn start:server
yarn start:socket
yarn lint
yarn test
yarn build
```

Focused checks:

```sh
yarn turbo run lint --filter=letscube-client
yarn turbo run test:ci --filter=letscube-client
yarn turbo run lint --filter=letscube-server
yarn turbo run test:ci --filter=letscube-server
yarn turbo run lint --filter=letscube-scrambles
yarn turbo run test:ci --filter=letscube-scrambles
```

The client test runner accepts Jest arguments through `client/scripts/test.js`.
For example:

```sh
yarn workspace letscube-client test --watchAll=false RoomConfigureDialog.test.jsx
yarn workspace letscube-server test roomAuthorization.test.js
```

## PostgreSQL Migrations

Prisma owns `server/prisma/schema.prisma` and the committed migration history.

```sh
# Apply committed migrations
yarn workspace letscube-server postgres:migrate

# Create a migration while developing a schema change
yarn workspace letscube-server postgres:migrate:dev

# Validate the Prisma schema
yarn workspace letscube-server postgres:schema:validate

# Compare the migrated database with the schema
yarn workspace letscube-server postgres:schema:check
```

The schema check needs a reachable migrated PostgreSQL database. See
[Data and migrations](data.md) before changing tables or mirror behavior.

## Full-Stack Cypress

Cypress expects the client, API, and Socket.IO server on their standard ports.
One local sequence matching CI is:

```sh
docker compose -f docker-compose.yml up -d
LETSCUBE_TEST_AUTH=true yarn workspace letscube-server node index.js
yarn workspace letscube-server node socket/
yarn workspace letscube-client start
yarn cypress:run
```

Run the long-lived commands in separate terminals. `yarn cypress:open` starts
the interactive Cypress UI against the same stack.

The test-only authentication mode bypasses WCA OAuth for Cypress fixtures. Do
not use it for production-like testing.

## Troubleshooting

### A port is already in use

Inspect listeners before starting another copy of the app:

```sh
lsof -nP -iTCP:3000 -iTCP:8080 -iTCP:9000 -sTCP:LISTEN
```

When testing an isolated worktree, use a complete set of alternate client, API,
and socket ports so the client does not accidentally connect to another
branch's backend.

### Docker points at a missing socket

Check `docker context show`, `docker context ls`, `DOCKER_HOST`, and
`DOCKER_CONTEXT`. Select a working engine before changing project files; a
stale Docker Desktop context is an environment problem, not an application
failure.

### A service is unhealthy

```sh
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs mongo postgres redis
```

The API and Socket.IO health endpoints are `http://localhost:8080/health/api`
and `http://localhost:9000/health/socket`.

### Tooling changes break unexpectedly

The client uses React 18, Material UI 6, Jest 30, ESLint 9, and Vite 8. Run
client unit tests and `yarn workspace letscube-client build` after dependency or
build-tool changes; success in only one path is not sufficient.
