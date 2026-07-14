# Data And Migrations

Let's Cube currently uses MongoDB as its source of truth and PostgreSQL as a
non-blocking dual-write target. Redis is runtime coordination, not durable
application storage.

## MongoDB

MongoDB owns application reads and primary writes. Mongoose models cover:

- users and WCA profile/preferences;
- rooms, participants, attempts, scrambles, and results;
- pseudonymous metric events; and
- Express sessions through `connect-mongo`.

Room attempts and participant state are embedded in room documents. User-keyed
maps use string forms of WCA numeric user IDs. Normal empty rooms use the
`expireAt` TTL index for delayed cleanup.

MongoDB write success determines application success. PostgreSQL mirror failure
must not reject a Mongo-backed operation during the current migration phase.

## PostgreSQL

Prisma defines PostgreSQL in `server/prisma/schema.prisma`, using two schemas:

| Schema | Contents |
| --- | --- |
| `app` | users, rooms, participants, attempts, and solves |
| `analytics` | pseudonymous metric events |

PostgreSQL receives normalized copies of users/preferences, rooms and
participant state, attempts, durable solves, and sanitized analytics. OAuth
access tokens are deliberately not mirrored.

Application reads do not use PostgreSQL yet. Setting `POSTGRES_ENABLED=false`
disables initialization and mirrors. PostgreSQL failures are logged, while API
and Socket.IO health report the service as `degraded` instead of unavailable.

## Dual-Write Guarantees

`server/postgres/dualWrite.js` derives stable UUIDs from Mongo/WCA identifiers
and uses upserts so retries and future backfills remain idempotent.

Room saves collect changed attempts/results and mirror only that delta. An
explicit event change replaces that room's PostgreSQL attempts so attempts
removed from MongoDB do not remain queryable. Complete snapshots are reserved
for explicit backfill behavior.

The mirror intentionally catches database failures and returns control to the
MongoDB-backed request. Monitoring must surface mirror errors because users may
otherwise see success while PostgreSQL lags.

PostgreSQL `solves.time_ms` is an integer. Any ingestion path accepting
fractional JavaScript numbers must normalize or reject them explicitly rather
than relying on PostgreSQL coercion.

## Prisma Workflow

Apply committed migrations:

```sh
yarn workspace letscube-server postgres:migrate
```

Create a migration during development:

```sh
yarn workspace letscube-server postgres:migrate:dev
```

Validate the schema and detect drift:

```sh
yarn workspace letscube-server postgres:schema:validate
yarn workspace letscube-server postgres:schema:check
```

CI starts PostgreSQL 17, validates the Prisma schema, applies every committed
migration, and checks the resulting database against `schema.prisma`.

Production runs `prisma migrate deploy` as a one-shot Compose service before
application replacement. Application rollback does not reverse migrations, so
migrations must remain compatible with both the new image and the immediately
previous image.

When runtime traffic uses a pooled `DATABASE_URL`, configure
`DIRECT_DATABASE_URL` for Prisma migration operations. External PostgreSQL can
enable TLS with `PGSSL`; certificate verification is enabled by default and a
CA can be supplied with `PGSSL_CA`.

## Metrics And Privacy

The metrics recorder stores room and authentication events in MongoDB's
`metric_events` collection and PostgreSQL's `analytics.events` table. It tracks
room creation, join success/failure, leave duration/reason, accepted results,
peak room users/solves, and authentication failures.

Actors and rooms are pseudonymized with HMAC-SHA256. Production should set a
dedicated `METRICS_HASH_SECRET`; otherwise the auth secret is used. Changing the
hash secret breaks correlation with older metric records.

Metrics must not contain:

- names, email addresses, or WCA IDs;
- room names, passwords, or access codes;
- OAuth credentials or session data;
- chat content;
- scramble text; or
- solve times.

Raw events expire after 90 days by default. The Node runtime recognizes
`METRICS_RETENTION_DAYS`, `METRICS_ENABLED`, and `METRICS_HASH_SECRET` when they
are present in its process environment. The production Compose configuration
forwards those values from `.env.prod` to both application services. Keep the
hash secret only in `.env.prod`; Compose does not print it during normal
startup.

MongoDB uses a TTL index; PostgreSQL maintenance deletes expired analytics
records periodically.

## Backups And Restore

The repository backup scripts currently protect MongoDB, the application source
of truth. PostgreSQL can be rebuilt from future backfills only to the extent the
mirror covers the desired history; do not assume it is a complete MongoDB
backup.

See [Production operations](operations.md#backups) for retention and restore
procedures. Never use routine Docker cleanup to remove database volumes.

## Changing Persistence

Before a data change, identify:

1. the MongoDB source shape and read path;
2. whether PostgreSQL needs a new backward-compatible migration;
3. mirror idempotency and retry behavior;
4. backfill requirements for existing documents;
5. privacy and retention effects; and
6. health, monitoring, backup, and rollback consequences.

Moving reads to PostgreSQL or making PostgreSQL required is a separate migration
decision and must not happen incidentally as part of a schema change.

The planned Room-to-RaceSession cutover has a separate
[backfill and reconciliation contract](race-session-backfill.md). It requires
resumable, privacy-safe verification before PostgreSQL becomes authoritative
for rooms, race sessions, attempts, and solves.
