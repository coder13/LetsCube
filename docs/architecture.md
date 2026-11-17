# Architecture

Let's Cube is a realtime progressive web app with independently running HTTP
and Socket.IO servers. The browser is built once and served by the HTTP process
in production.

## System Topology

```text
                         +--------------------+
                         |   React / Redux    |
                         |      browser       |
                         +---------+----------+
                                   |
                         HTTPS and Socket.IO
                                   |
                         +---------v----------+
                         |       nginx        |
                         +----+-----------+---+
                              |           |
                    HTTP/API  |           | /socket.io
                              |           |
                     +--------v--+     +--v-------------+
                     | Express   |     | Socket.IO      |
                     | API/static|     | room/default NS|
                     +-----+-----+     +---+----------+-+
                           |               |          |
                           +-------+-------+          |
                                   |                  |
                              +----v------+       +----------+
                              |PostgreSQL |       |  Redis   |
                              | source    |       |coordination|
                              +-----------+       +----------+
```

PostgreSQL owns durable application state. Redis provides ephemeral
coordination; active room aggregates are bounded by a per-process LRU cache.

## Repository Boundaries

| Path | Responsibility |
| --- | --- |
| `client/` | React UI, Redux state, socket middleware, timers, and PWA assets |
| `server/` | Express API, authentication, Socket.IO, PostgreSQL repositories, cache, and metrics |
| `packages/scrambles/` | Browser-safe event catalog and server-side scramble generation |
| `cypress/` | Full-stack browser smoke tests |
| `scripts/` | Deployment, rollback tests, backup, and restore tooling |

The root is a Yarn classic workspace managed by Turbo. Shared code should live
in a workspace package rather than importing source files across client/server
boundaries.

## Runtime Processes

### Browser client

The client uses React 16, Redux, connected-react-router, Material UI v4, and
Socket.IO Client. Vite serves and builds the client; Jest still uses the older
CRA/Babel-compatible test transforms. Socket connections are owned by Redux
middleware under `client/src/store/middlewares/` so connection state and room
state stay coordinated outside the component lifecycle.

### HTTP/API process

`server/index.js` starts Express on port `8080`. It:

- connects to PostgreSQL;
- installs the shared PostgreSQL session middleware and Passport;
- serves `/auth`, `/api`, and `/health/api`;
- serves the production client build; and
- falls back to `index.html` for client-side routes.

### Socket.IO process

`server/socket/index.js` starts Socket.IO on port `9000`. It:

- shares the Express session through `express-socket.io-session`;
- authenticates sockets from the session;
- uses the Redis adapter for cross-process socket coordination;
- exposes the default (`/`) and rooms (`/rooms`) namespaces; and
- exposes `/health/socket` on the same HTTP server.

The API and Socket.IO processes can be replaced independently, but shared
protocol changes must remain compatible while two revisions briefly overlap
during a deployment.

## Authentication And Sessions

WCA OAuth is the normal authentication path. The API creates an Express session
stored in PostgreSQL, and both the HTTP and Socket.IO processes read that session.
Browser API requests include credentials, and Socket.IO is configured for
credentialed cross-origin connections.

Development defaults point at the WCA staging site. The test-only custom login
flow is enabled with `LETSCUBE_TEST_AUTH=true` and must not be enabled in
production.

## Data Services

- **PostgreSQL** is the application source of truth and backs sessions, users,
  rooms, results, social data, and metric events.
- **Redis** supports the Socket.IO adapter and cross-instance presence checks.
- **PostgreSQL** is required by both application processes. MongoDB models are
  retained only by the one-time migration tool.

See [Data and migrations](data.md) for schemas and consistency guarantees.

## Production Shape

The production Compose stack runs `api`, `socket`, `postgres`,
`redis`, and `nginx`. API and Socket.IO use the same immutable application image
tagged with the deployed commit SHA. nginx terminates TLS, routes Socket.IO
traffic to `socket`, and sends all other traffic to `api`.

See [Production operations](operations.md) for rollout and recovery behavior and
[Realtime behavior](realtime.md) for disconnect and result-delivery contracts.
