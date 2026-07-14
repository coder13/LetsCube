# Room-to-RaceSession backfill and reconciliation contract

This document defines the safe migration contract for issue #175. It is a
specification only: it adds no migration, command, MongoDB write, or production
operation. It applies after the additive `RaceSession` schema is available and
before PostgreSQL becomes authoritative for the complete room aggregate.

The [data migration guide](data.md) describes the current MongoDB-backed
dual-write phase. The target Room and RaceSession ownership contract is a
prerequisite for implementing this specification.

## Scope and source boundary

At the start of this work, MongoDB is authoritative. A legacy Mongo room maps
to exactly one PostgreSQL Room and exactly one initial RaceSession, including
its current attempts, results, and participant state. The backfill must not
infer, synthesize, or claim to recover events that a prior legacy event change
removed from the embedded `attempts` array. This is an intentional data-loss
boundary of the legacy model, not a reconciliation mismatch.

The backfill copies only the room aggregate:

| Source | Target |
| --- | --- |
| Mongo `Room` metadata | `app.rooms` |
| current Mongo `event`, `started`, `startTime`, and `nextSolveAt` | one initial `app.race_sessions` row |
| Mongo users, bans, and room-level presence/membership maps | `app.room_participants` |
| Mongo competing, waiting, and registration maps | `app.session_participants` for the initial session |
| Mongo embedded attempts | `app.attempts` for the initial session |
| Mongo attempt results | `app.solves` for those attempts |

The implementation must document an explicit projection for every legacy
field. A field with no target owner is either left in Mongo for the compatible
runtime or is intentionally excluded; it must not be silently attached to a
different aggregate.

## Deterministic identity

The existing `server/postgres/dualWrite.js` UUIDv5 namespace and `stableId`
helper are the identity authority during the compatibility phase. The
implementation must use it consistently and must not generate random IDs
during a retry or a subsequent backfill run.

| Target record | Required deterministic key |
| --- | --- |
| Room | `stableId('room', mongoRoomId)` |
| initial RaceSession | `stableId('race-session', mongoRoomId)` |
| RoomParticipant | `(roomId, stableId('user', wcaUserId))` |
| SessionParticipant | `(raceSessionId, stableId('user', wcaUserId))` |
| Attempt | the existing `stableId('attempt', attemptMongoId)` key |
| Solve | the existing `stableId('solve', attemptMongoId + ':' + wcaUserId)` key |

`attemptMongoId` retains the current compatibility rule: use the embedded
attempt `_id` when present; otherwise derive the documented fallback from room,
event, creation time, and ordinal. The new session relation must preserve the
existing attempt and solve IDs, so a schema expansion links rows rather than
re-ingesting duplicate results.

The initial RaceSession is identified by the room Mongo ID only because it is
the one session reconstructed from the one current legacy room. New sessions
created after the cutover receive a different, durable session identity from
the Room/RaceSession service; they are never conflated with this initial
backfill session.

## Resumable execution

The eventual command must default to dry-run. It must expose an explicit
`--apply` mode, bounded batch size, and a supplied or newly created run ID. A
run checkpoint is durable PostgreSQL migration state, not process memory or a
terminal log. It records at least the schema version, source filter, batch
size, last completed source cursor, completed-batch count, started/finished
times, and terminal status.

Rooms are read in a stable Mongo `_id` order. A completed batch has committed
every target row for its complete room aggregate, including attempts and solves,
or has no checkpoint advancement. The writer uses one PostgreSQL transaction
per source room. Re-running a committed batch is safe because all identities
are deterministic and upserts compare source revisions.

A failed room records a redacted failure classification and retry count without
advancing its cursor. A resumed run retries that room before later work. A run
may skip a permanently invalid source row only with an explicit operator
decision recorded in the final report; it cannot silently count that row as
complete. Batches must be small enough that a retry does not hold a transaction
open while reading another room.

## Live-write no-loss rule

Backfill alone cannot guarantee a consistent result while rooms are racing.
Before the first apply run, the compatible room write path must mirror every
full aggregate mutation to the expanded PostgreSQL model and record a durable,
monotonic source change watermark. The watermark must cover room creation,
membership/moderation changes, session/racing state, attempt creation, and
solve submission.

The implementation performs the following sequence:

1. Enable and verify the compatible live writer without changing read
   authority.
2. Record a source watermark, backfill every room up to that boundary, then
   drain and apply all later durable change records.
3. Repeat the drain until a parity pass observes no unapplied change records.
4. Keep the live writer enabled through the shadow-read observation window.

An acknowledgement for a live mutation is valid only after its source write and
the compatible target write/change record meet this protocol. A transient
PostgreSQL error therefore leaves the room marked for retry and visible in
operational health; it must not be hidden by declaring the reconciliation
complete. The exact outbox or revision mechanism is an implementation decision,
but an in-memory queue, wall-clock timestamp alone, or best-effort log scan is
not sufficient.

## Parity and reports

Reconciliation is read-only against both stores. It compares canonical source
projections with PostgreSQL by deterministic identity and emits machine-readable
JSON plus an aggregate operator summary. A clean report contains zero
unexplained differences for:

- Room metadata and lifecycle projection;
- exactly one initial RaceSession for every mapped legacy room;
- room and session participants, including moderation and racing state;
- attempts, ordinal, event, and immutable scramble content; and
- solves, user, time, penalties, and source timestamps.

Every difference has a category: `missing_target`, `unexpected_target`,
`identity_mismatch`, `field_mismatch`, `invalid_source`, `unapplied_change`, or
`legacy_history_unrecoverable`. The final category is informational only when
it identifies legacy event history absent from Mongo; it cannot hide a missing
current attempt or solve. The report includes input/cursor bounds, counts by
category, retry status, and a pseudonymous HMAC identifier for any source row
requiring investigation. It does not include raw source documents.

Before changing read authority, two consecutive full parity passes must be
clean with no unapplied live changes between the report watermarks. A separate
shadow-read comparison then verifies the PostgreSQL projection against the
Mongo response for the unchanged normal-room flow. Any mismatch blocks cutover
and is remediated by an idempotent retry or an explicitly documented data fix,
followed by a new full parity pass.

## Fixture specification

The implementation test suite must use synthetic fixtures only and cover these
cases:

| Fixture | Required assertion |
| --- | --- |
| normal room with current event, two attempts, and accepted/penalized solves | creates one initial RaceSession; preserves deterministic room, attempt, and solve IDs across two apply runs |
| room with no embedded attempts | creates its initial session and participants without manufacturing an attempt or solve |
| legacy room after an event change | maps only its current event and embedded attempts; reports no invented earlier event session |
| room with an embedded attempt lacking `_id` | uses the documented fallback identity and remains idempotent |
| mixed participant maps, including a banned user | keeps room moderation separate from initial session racing state |
| interrupted batch followed by resume | leaves no partial aggregate checkpoint, retries the failed room, and reaches the same target as an uninterrupted run |
| live solve or attempt after the baseline watermark | is applied during drain and appears in the clean parity report |
| malformed source row or failed target transaction | records a redacted retryable failure and never advances the cursor as if it succeeded |
| target-only stale row | appears as `unexpected_target`; the backfill does not delete it automatically |

Fixtures may use synthetic scramble text to validate persistence, but report
fixtures assert only scramble count and a test-only hash. No fixture, snapshot,
or report may contain a real room name, password, access code, WCA ID, user
name, email address, OAuth/session value, or production scramble.

## Privacy and access constraints

The command reads no email fields and must neither query nor use them for
matching. It uses numeric WCA user IDs only to derive internal deterministic
user IDs. Logs, checkpoints, metrics, and reports must exclude email addresses,
names, WCA IDs, room names, passwords, access codes, raw scrambles, solve
times, chat, authentication/session data, and Mongo documents. Troubleshooting
uses categorized counts and keyed pseudonymous identifiers only.

Backfill and parity operate with database credentials, not user-facing room
access. They preserve private-room access policy in the target data and never
turn a private room into a discoverable result merely by copying it.

## Rollback compatibility

This phase is additive. It does not write MongoDB, delete MongoDB embedded
attempts/results, remove PostgreSQL rows, or switch application reads. The
immediately previous application image must tolerate the expanded schema and
ignore the new migration-run records.

If rollout is paused or rolled back before the aggregate cutover, stop the new
PostgreSQL writer, keep MongoDB as the source of truth, retain the additive
schema and checkpoints, and preserve the change records needed to reconcile
later writes. Do not reverse a committed database migration or purge target
history as part of rollback. Before a new cutover attempt, resume the backfill,
drain live changes, and require clean parity again.

MongoDB writes for room/session/result domains are removed only in the later
complete-aggregate cutover, after the rollback observation window. This
backfill contract does not authorize that removal.
