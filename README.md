# Let's Cube

Let's Cube is a progressive web app for racing other cubers in real time. It
combines a React client, an Express API, and a Socket.IO server with shared room
state and scramble generation.

The production site is [letscube.net](https://letscube.net).

## Repository Layout

- `client/` — React, Redux, Material UI, Vite, and the service worker
- `server/` — Express, authentication, Socket.IO, persistence, and metrics
- `packages/scrambles/` — shared event catalog and scramble provider
- `cypress/` — full-stack browser smoke tests
- `scripts/` — deployment, backup, restore, and deployment tests
- `docs/` — architecture, development, data, realtime, and operations guides

This is a Yarn classic workspace monorepo. Install dependencies from the root
and use the root `yarn.lock`.

## Quick Start

Prerequisites are Node `22.17.0`, Yarn `1.22.22`, Docker, and Docker Compose.

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
docker compose -f docker-compose.yml up -d
yarn workspace letscube-server postgres:migrate
```

Run the three application processes in separate terminals:

```sh
yarn start:client   # http://localhost:3000
yarn start:server   # http://localhost:8080
yarn start:socket   # http://localhost:9000
```

The default development configuration uses the WCA staging site. A real WCA
OAuth application is required to exercise the complete login flow.

See [Development](docs/development.md) for environment configuration, Docker
alternatives, tests, database migrations, and troubleshooting.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Realtime behavior](docs/realtime.md)
- [Data and migrations](docs/data.md)
- [Production operations](docs/operations.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Checks

```sh
yarn lint
yarn test
yarn build
```

The pre-commit hook runs lint and unit tests. Pull requests also run focused
client and server jobs plus a Cypress full-stack smoke test.

## Identity privacy

Let's Cube requests only the WCA OAuth `public` scope. WCA profile data is
allowlisted at login, and the application does not request, retain, mirror,
return, log, analyze, or search WCA email addresses or dates of birth. Product
identity uses the WCA numeric user ID internally and exposes a WCA ID only when
the user has explicitly enabled that existing profile preference.

Any user-discovery feature must accept only its documented username and visible
WCA ID formats. An email-like input must not be treated as an identifier or
produce an existence signal. This is a required invariant for the Friend System,
not a future discovery mode.

The server's owner/admin handoff and reconnect guarantees are documented in
[Room ownership and administration](docs/room-ownership.md).

## Metrics

The server stores pseudonymous room and authentication events in both the
`metric_events` MongoDB collection and the PostgreSQL `analytics.events` table.
It records room creations, joins, join failures, leaves and visit duration,
accepted result counts, and authentication failures. Peak room users and peak
room solve counts are the maximum `activeUserCount` and `roomSolveCount` values
for each pseudonymous room.

Raw events expire after 90 days by default. Set `METRICS_RETENTION_DAYS` to a
different positive number of days, or set `METRICS_ENABLED=false` to disable
collection. Production should set a dedicated `METRICS_HASH_SECRET`; when it is
not set, the session `AUTH_SECRET` is used. Changing this secret breaks the
ability to correlate pseudonymous users and rooms across the change.

Metrics never include names, email addresses, WCA IDs, room names, passwords,
access codes, OAuth credentials, chat content, scramble text, or solve times.

## PostgreSQL dual writes

New MongoDB writes are mirrored into PostgreSQL without changing application
reads. PostgreSQL receives public identity and preferences, rooms and
participant state, attempts, durable solve results, and sanitized analytics
events. OAuth access tokens are deliberately not copied. Writes use
deterministic UUIDs and upserts,
so retries and future backfills are idempotent. Live room saves mirror only the
attempts and results changed by that save; complete room snapshots are reserved
for explicit backfills. Changing a room event explicitly replaces that room's
PostgreSQL attempts so removed MongoDB attempts do not remain queryable.

Solve penalties use dedicated boolean columns rather than JSON so histories and
statistics remain compact and index-friendly. User solve history is indexed by
creation time and solve ID for stable cursor pagination.

Set `POSTGRES_ENABLED=false` to disable mirroring. Production should set
`PGHOST`, `PGDATABASE`, `PGUSER`, and `POSTGRES_PASSWORD`, or provide a
`DATABASE_URL`. When runtime traffic uses a pooled connection, set
`DIRECT_DATABASE_URL` to the direct connection used by Prisma Migrate. External
TLS connections can set `PGSSL=true` and provide a CA with `PGSSL_CA`;
certificate verification is enabled by default. PostgreSQL failures are logged
but do not fail the corresponding MongoDB-backed application operation during
this migration phase.

Username lookup uses a separately normalized, uniquely indexed key while
preserving display casing. See [the normalized username migration](docs/username-migration.md)
for the required collision audit, production order, and rollback procedure.

Friend relationships and directional blocks use revisioned tombstone rows;
strictly older mirrors are ignored so reordered background writes cannot
resurrect a removed relationship or a deactivated block.
Social notifications mirror only numeric recipient and actor references plus
their typed resource metadata; the notification mirror does not read or write
email addresses.

## License

Let's Cube is available under the terms in [LICENSE](LICENSE).
