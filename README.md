# Let's Cube

This is a Progressive Web app written in Node.JS, Express, MongoDB,
PostgreSQL, socket.io, React, and Material UI.

This project consists of a client and a server.

## Development:

Make sure Node.JS and Docker are installed. Docker Compose starts the local
MongoDB, PostgreSQL, and Redis services used by the app.

```
git clone https://github.com/coder13/letscube.git
cd letscube
yarn install
docker compose -f docker-compose.yml up -d
```

The local PostgreSQL service is exposed on port `55433` to avoid collisions
with other projects. MongoDB remains the source of truth while PostgreSQL is a
non-blocking dual-write target. Prisma owns the PostgreSQL schema and migration
history. Apply committed migrations locally with:

```bash
yarn workspace letscube-server postgres:migrate
```

Create schema changes during development with
`yarn workspace letscube-server postgres:migrate:dev`. Production Compose runs
`prisma migrate deploy` as a separate one-shot service, keeping schema changes
out of the API and Socket.IO startup paths. CI applies every committed migration
to PostgreSQL 17 and checks the resulting database for drift from
`server/prisma/schema.prisma`.

**Server**

The server is split across 2 processes:

```bash
yarn start:server # Starts the file server, auth, and API requests on port 8080
yarn start:socket # Run this in a separate terminal for Socket.IO on port 9000
```

**Client**

```bash
yarn start:client
```

For more on the internals and contributing, check out the [wiki](https://github.com/coder13/LetsCube/wiki)

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

## Metrics

The server stores pseudonymous room and authentication events in both the
`metric_events` MongoDB collection and the PostgreSQL `analytics.events` table.
It records room creations, joins, join failures, leaves and visit duration,
accepted result counts, and authentication failures. Peak room users and peak
room solve counts are the maximum `activeUserCount` and `roomSolveCount` values
for each pseudonymous room. Friend-system metrics contain only the pseudonymous
actor, action category, and outcome; they never contain the other user or a
relationship/pair identifier.

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
