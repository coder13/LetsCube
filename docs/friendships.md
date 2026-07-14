# Friendship and blocking contract

MongoDB is the source of truth for friendship state. PostgreSQL receives
non-blocking, idempotent mirrors and must never be read to authorize a social
action while the dual-write migration is in progress.

## Rollout gate

The feature is controlled by the small in-code `friends` map in `server/features.js`
and `client/src/lib/features.js`. It is enabled only outside production and
also requires `SOCIAL_FEATURES_ENABLED=true` on the server. In production,
`/api/friends` returns `404 feature_disabled`, social navigation is hidden, and
the socket process does not subscribe to social invalidations. Existing room
behavior is unchanged. Issue #188 owns launch hardening and production
operation of this same switch; adding the foundation does not enable it.

## Identity and privacy

Social APIs accept only the authenticated session user and a numeric target
user id. Responses use an explicit public projection containing `id`,
`username`, and `displayName`; `wcaId` and `avatar` are included only when that
user has enabled WCA identity visibility. Email is not part of this feature's
request, lookup, response, log, realtime, or metrics contracts.

An API error never says that either user blocked the other. Both block
directions produce the generic `relationship_unavailable` response. A user may
list blocks they created so they can undo them, but cannot list blocks created
by someone else.

## Canonical state

There is at most one `friend_relationships` document for an unordered user
pair. `pairKey` is `<lower numeric user id>:<higher numeric user id>` and has a
unique index. Direction belongs only to `requestedBy`. A separate
`user_blocks` document represents each directional block.

Relationship transitions are:

| Current state | Action | Result |
| --- | --- | --- |
| none | send | pending, requested by actor |
| pending by actor | send | unchanged |
| pending by target | send | accepted (crossed requests) |
| pending by target | accept | accepted |
| pending by actor | cancel | canceled for 60 seconds |
| pending by target | decline | declined for 24 hours |
| accepted | unfriend | removed tombstone |
| any | block | relationship tombstoned; directional block retained |
| blocked by actor | unblock | directional block removed; no friendship restored |

Replayed send, cancel, accept, decline, unfriend, block, and unblock operations
are idempotent. An invalid direction, such as accepting an outgoing request, is
`409 invalid_relationship_transition`. Self-actions and malformed ids are
`400` errors.

Updates compare the document revision before writing. A unique-pair conflict or
concurrent revision change is read again and the transition is recalculated.
Both friendship writes and block writes check blocking after mutation, so a
concurrent block wins and tombstones the relationship. After bounded contention,
the API returns `409 relationship_conflict` and the caller should reconcile.

`removed` relationships and inactive blocks are durable MongoDB tombstones,
not physical deletes. Each update increments that resource's revision.
PostgreSQL upserts accept only a strictly newer revision, so a delayed request,
friendship, or active-block mirror cannot overwrite a newer remove/unblock.
This ordering contract is database-backed and therefore works across API
processes and restarts; it does not depend on an in-process promise queue.

Blocking activates the directional block before tombstoning the relationship,
so failures remain fail-closed. Unblocking repeats relationship cleanup before
deactivating the block. If cleanup fails, the active block remains and the
hidden relationship cannot reappear.

New request creation is atomically rate-limited in Redis before MongoDB writes:
each actor may create 30 requests per 10-minute window, and each normalized
pair may create 3 requests per 24-hour window. One Lua operation checks both
limits before it increments either counter and gives both counters a Redis TTL.
This works across API processes, needs no reconciliation or crash cleanup, and
fails closed with `503 request_rate_limit_unavailable` if Redis cannot execute
the operation. A rate-limited request is `429 request_rate_limited` with
`retryAfterSeconds`. The limiter intentionally bounds creation attempts rather
than retaining an unbounded count of pending relationships.

The existing per-pair resend cooldown remains: a declined pair may not be
requested again for 24 hours, and a canceled pair may not be requested again
for 60 seconds. `request_cooldown` includes `retryAfterSeconds`.

## REST API

All routes require an authenticated session.

| Method | Route | Operation |
| --- | --- | --- |
| `GET` | `/api/friends` | Reconcile friends, requests, and blocks |
| `POST` | `/api/friends/requests` | Send `{ "userId": number }` |
| `DELETE` | `/api/friends/requests/:userId` | Cancel an outgoing request |
| `POST` | `/api/friends/requests/:userId/accept` | Accept an incoming request |
| `POST` | `/api/friends/requests/:userId/decline` | Decline an incoming request |
| `DELETE` | `/api/friends/:userId` | Unfriend |
| `PUT` | `/api/friends/blocks/:userId` | Block |
| `DELETE` | `/api/friends/blocks/:userId` | Unblock |

`GET /api/friends` is the durable reconciliation endpoint. Its response has
`friends`, `incoming`, `outgoing`, `blocked`, and `reconciledAt`. Clients must
treat it as authoritative rather than applying relationship state locally.

## Realtime invalidation

After a durable change, the API publishes one typed
`friend_state_invalidated` event for both users. The Socket.IO process relays a
payload containing only `schemaVersion` and `occurredAt` to each authenticated
user room. It deliberately does not describe the action or the other user.

On this event, after reconnect, and whenever an action has an ambiguous network
result, clients fetch `GET /api/friends`. Realtime delivery is an optimization;
missing an event cannot corrupt durable state.

## Metrics

`social_action` events record only the pseudonymous actor, action category, and
outcome. They do not record target ids, pair keys, relationship ids, user
projections, or graph edges.
