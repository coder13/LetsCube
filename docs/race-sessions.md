# Room and RaceSession contract

A room is a durable place people join. A `RaceSession` is one independent
stream of racing activity within that room. This distinction lets a room retain
completed attempts when its event changes and lets a competition room host more
than one event without making ordinary rooms more complicated.

This is the target contract for the PostgreSQL migration. It does not change
the current MongoDB-backed runtime by itself.

## Ownership

| Entity | Owns |
| --- | --- |
| Room | name, access code and password policy, visibility, lifecycle, owner/admin, room kind, and an optional competition reference |
| RaceSession | room, event, race mode/format, scramble stream, status, scheduled and actual start/end times |
| RoomParticipant | room membership, moderation, room role, durable membership and presence revisions |
| SessionParticipant | eligibility, registration, competing, and waiting state for one race session |
| Attempt | one race session, an ordinal within that session, and immutable scrambles |
| Solve | one attempt, one user, time, penalties, timestamps, and the idempotency key used for result delivery |

`RaceSession` is deliberately used instead of `Session` so it cannot be
confused with the browser's authentication session.

`competitionRef` is a nullable external reference on a Room, not a local
competition table in this foundation. A Room has kind `normal` or
`competition`; a RaceSession has its own race mode/format. This keeps the
foundation independent of future competition discovery or registration sync.

## Normal rooms

Creating a normal room atomically creates its first RaceSession. The existing
create-room, copy-link, join, and race flow selects that session automatically;
it does not ask the user to choose a session or add a new step.

A normal room has exactly one non-terminal RaceSession. Its client-facing
`event`, `started`, `nextSolveAt`, current attempt, and waiting/competing view
are projections of that active RaceSession. Existing socket payloads continue
to expose those fields during the compatibility phase; callers that do not send
a RaceSession ID operate on the room's active session.

An authorized event change is one durable operation:

1. finish the current RaceSession and record `endedAt`;
2. create a new RaceSession for the requested event; and
3. make the new session the normal room's only non-terminal session.

It never deletes or rewrites the old session's attempts or solves. Attempt
generation for the new session follows the current normal-room rules, so an
event change does not create a different visible timer workflow.

## Competition rooms

A competition room has ordinary room membership once, then may expose multiple
available RaceSessions. A participant selects a RaceSession without leaving the
room. Selecting or racing in one session must not alter attempts, results,
waiting state, or eligibility in another.

Competition-session selection is additive to the protocol. Normal rooms never
show a session picker. Clients must always be able to identify the selected
event and session, and a stale selection must fail safely rather than submit a
solve to a different session.

## Examples

In a normal `Tuesday practice` room, creating the room creates a `333`
RaceSession. When the admin changes its event to `222`, the `333` session ends
with its attempts and solves intact, and a new `222` session becomes the room's
automatic active session. A joining user still sees one room and one race, just
as they do today.

In a competition room for `Example Open`, the room can offer a `333` session
and a `222` session at the same time. Maya joins the room once, chooses `333`,
and submits a solve. She can then choose `222` without leaving; its first
attempt and waiting state are independent, while her `333` solve remains with
the `333` session.

## State and authorization

RaceSession statuses are `ready`, `racing`, `paused`, `ended`, and `cancelled`.
Only `ready`, `racing`, and `paused` are non-terminal. A session records
`scheduledStartAt` when applicable, `startedAt` when racing begins, and
`endedAt` when it becomes terminal. A terminal session accepts neither new
attempts nor new solves, but its authorized history remains readable.

Room ownership and administration preserve the existing
[room ownership contract](room-ownership.md): the owner is the permanent
creator/deletion authority, while the active admin controls room configuration
and moderation. A room operation refreshes canonical state and authorizes it
before changing a session. Session control defaults to the current room admin;
there is no separate session-admin role in this milestone.

RoomParticipant owns the room-level ban, membership, role, and durable
membership/presence revision used for reconnect-safe handoff. A banned user has
no SessionParticipant access. SessionParticipant owns event eligibility,
registration, competing, and waiting state. Redis owns live socket counts,
transport reconnect timers, and cross-process fan-out; it is not the durable
record of room or racing state.

## Attempts and solves

An Attempt belongs to exactly one RaceSession and has an ordinal unique within
that session. Its scrambles are immutable once published. A Solve belongs to
exactly one Attempt and user; the attempt/user pair is unique. Retried result
delivery uses the existing immutable attempt key and submission ID, so it
returns the original accepted solve rather than creating another one.

The service must commit all durable changes needed by an operation before it
acknowledges success or broadcasts a realtime event. In particular, creating an
attempt, accepting or editing a solve, ending/creating sessions on event change,
and membership/participant updates use one transaction where they change more
than one entity.

Solves derive their room through Attempt and RaceSession. The expansion
migration may retain `solves.room_id` temporarily for compatibility and parity
checks, but it must be constrained to agree with the derived room and removed
in the contract phase.

## Lifecycle, privacy, and history

Hiding, expiry, or owner deletion stops new participation and removes the room
from ordinary discovery; it does not cascade-delete RaceSessions, Attempts, or
Solves. Event changes likewise preserve historical data. A physical cleanup is
a separate, explicit retention operation after the rollback window and must not
be part of normal room lifecycle code.

Private, hidden, and deleted-room history is authorized server-side. It is not
discoverable publicly and is returned only to a user who was authorized to
participate in that room, subject to the room's retention/deletion policy.
History responses expose no password, access code, membership list, or
moderation data. The later history API work in #174 and #160 implements this
read contract after the aggregate cutover.

## Stable identity and migration compatibility

Room IDs and access codes remain stable across the migration. Existing MongoDB
rooms map to one Room and one RaceSession for their current event; historical
event sessions that legacy behavior deleted are not invented. Existing attempt
and solve identifiers remain deterministic during backfill.

The migration expands PostgreSQL first, dual-writes and reconciles the complete
aggregate, then switches Room, RaceSession, Attempt, Solve, and participant
reads together. MongoDB must not remain authoritative for room metadata while
PostgreSQL is authoritative for results. The temporary rollback path retains
compatible data without reversing migrations; the later cleanup removes MongoDB
room/result persistence only after the observation window succeeds.
