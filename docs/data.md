# Data And Migrations

PostgreSQL is the source of truth for all durable application data. Redis is
used only for Socket.IO coordination, presence, and rate limiting. The server
does not connect to MongoDB at runtime.

## PostgreSQL

Prisma defines the schema in `server/prisma/schema.prisma`:

| Schema | Contents |
| --- | --- |
| `app` | users, rooms, room/session participants, race sessions, attempts, solves, social data, and sessions |
| `analytics` | pseudonymous metric events |

Room history is normalized into attempts and solves. Active room aggregates are
shared through a per-process weighted LRU cache capped at 128 MiB with a 60
second TTL. Rooms with no connected users receive a ten-minute expiry; expiry
hides the room from active listings while preserving SQL history.

OAuth access tokens are used only during the WCA authorization request and are
not persisted. Existing login sessions are intentionally invalidated during
the cutover because sessions are now stored in `app.sessions`.

## Cutover and migration

The one-time MongoDB backfill tool is migration-only and is never imported by
the API or socket entrypoints. Run a dry run, schedule a maintenance window,
take a PostgreSQL backup, then run:

```sh
yarn workspace letscube-server postgres:migrate-from-mongo
yarn workspace letscube-server postgres:migrate-from-mongo --apply
```

The tool copies users, rooms and race history, social relationships/blocks,
notifications, and metrics. Sessions are not copied; users must authenticate
again after the big-bang cutover. Verify row counts and representative room,
solve, and social records before starting the new application processes.

The shared `server/postgres/dualWrite.js` helpers provide stable identifiers
and idempotent upserts for the migration tool and compatibility model code;
they are not a MongoDB runtime dependency.

PostgreSQL `solves.time_ms` is an integer. Any ingestion path accepting
fractional JavaScript numbers must normalize or reject them explicitly rather
than relying on PostgreSQL coercion.

## Prisma workflow

```sh
yarn workspace letscube-server postgres:migrate
```

```sh
yarn workspace letscube-server postgres:schema:validate
yarn workspace letscube-server postgres:schema:check
```

Production runs `prisma migrate deploy` as a one-shot service before replacing
the application containers. Configure `DIRECT_DATABASE_URL` when the runtime
`DATABASE_URL` is a pooled connection, and use `PGSSL`/`PGSSL_CA` for external
PostgreSQL TLS.
