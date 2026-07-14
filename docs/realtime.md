# Realtime Behavior

Realtime state is split between Socket.IO namespace handlers on the server and
Redux middleware in the browser. This document describes the contracts that
must survive reconnects and rolling deployments.

## Namespaces And Ownership

The server exposes two namespaces:

- `/` tracks global presence and exposes Socket.IO health checks.
- `/rooms` owns room discovery, joins, room state, chat, timing results, and
  administration.

Protocol constants live in `client/src/lib/protocol.js` and its JSON source.
The server imports the same definitions. Add or change events across the shared
constants, client middleware, server handlers, and tests together.

`Protocol.ERROR` maps to the historical literal event name `errorrr`. Renaming
it to `error` risks colliding with Socket.IO error behavior and requires a
deliberate compatibility migration.

The browser's connections are managed under `client/src/store/middlewares/`.
React components dispatch actions and consume Redux state; they should not own
independent namespace connections.

## Session Authentication

The Express session is stored in MongoDB and attached to Socket.IO through
`express-socket.io-session`. Socket authentication derives the user from that
shared session. Socket.IO and API requests therefore depend on credentialed
cookie behavior remaining aligned across the browser, CORS, nginx, and both
Node processes.

Redis backs the Socket.IO adapter. It allows namespace operations and presence
checks to account for sockets connected to more than one Socket.IO process.

## Room Join And State Visibility

The rooms namespace distinguishes lobby users from joined users. Lobby payloads
are masked more aggressively; joined-room payloads include the state required
to participate. Room passwords and other private authorization state must not
be exposed through lobby updates or logs.

Room participant maps are keyed by WCA numeric user IDs converted to strings.
This convention applies to waiting, competing, banned, in-room, and registered
state.

Private-room passwords are cached per room in browser local storage after a
successful join so a reconnect can repeat the join. The cached value is cleared
when the room disappears, becomes public, or rejects the saved password.

## Disconnect Versus Leave

A transport disconnect is temporary; an explicit leave, kick, or ban is an
immediate room operation.

On disconnect, the server schedules departure after
`ROOM_RECONNECT_GRACE_MS` (60 seconds by default). If the user reconnects before
the timer completes, cleanup is cancelled. Before final departure, the server
checks for another active socket for the same user and room through the Redis
adapter. This prevents a deploy or second browser tab from producing a false
leave.

During the grace window, preserve:

- room membership;
- the current attempt and scramble;
- waiting and competing state; and
- room administration.

Normal empty rooms receive an expiration timestamp. Explicit moderation and
leave actions do not use reconnect grace.

## Client Rejoin

Socket.IO reconnecting is only the transport step. The client must then rejoin
the rooms namespace and receive a successful room acknowledgement before it can
resume room-scoped operations.

While reconnecting, keep the current room UI and timer state mounted. Do not
reset room state merely because the transport disconnected. If the room cannot
be rejoined, the UI must expose that state rather than silently submitting to a
different or unjoined room.

## Result Delivery

An in-progress solve is browser state and continues while the server is
unavailable. If the solve finishes before the room is rejoined, the client:

1. creates a versioned pending result with a unique `submissionId` and immutable
   attempt key;
2. stores it in local storage before attempting delivery;
3. blocks the next solve while that result is unresolved;
4. waits for both Socket.IO reconnect and successful room rejoin;
5. retries acknowledgement timeouts and retryable errors; and
6. clears the local copy only after the server acknowledges persistence.

The server validates the attempt ID/key and uses `submissionId` to make retries
idempotent. Repeating the same submission returns success without creating a
second result. A conflicting result for the same user and attempt is rejected.

The browser may accept the matching result echo as confirmation for older
server behavior, but new protocol work should use explicit acknowledgements.

## Rolling Deployment Compatibility

Production deploys replace Socket.IO before API/static. For a short period, the
new Socket.IO server may serve the old browser bundle; after API replacement,
the new browser may connect through clients with cached older assets.

Protocol changes should therefore be additive or tolerant across adjacent
revisions. Avoid changing one event to mean two directions of traffic: use
separate incoming and broadcast events to prevent echo loops.

Grand Prix is a legacy timer-driven mode and is disabled in production by
default with `GRAND_PRIX_ENABLED=false`. Normal-room lifecycle changes should
not depend on Grand Prix behavior.

## Health

`GET /health/socket` checks MongoDB, Redis, and optional PostgreSQL. The default
namespace also accepts `health_check`; it returns the same report through the
acknowledgement callback or emits `health_status` when no callback is supplied.

## Change Checklist

For a realtime behavior change, check:

- shared protocol constants;
- client Redux middleware and reducers;
- namespace authorization and payload masking;
- disconnect, reconnect, and multi-tab behavior;
- acknowledgement and retry behavior;
- old-client/new-server compatibility; and
- focused client and server socket tests plus the Cypress smoke test.
