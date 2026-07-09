# Let's Cube Agent Gotchas

This file is intentionally short. It captures repo-specific traps that are easy
to miss when making changes here.

## Project Layout

- This is a Yarn classic workspace monorepo. `client/` and `server/` are
  workspaces, and the root `yarn.lock` is the only dependency lockfile.
- Root scripts are workspace-aware and mostly run through Turbo. Prefer root
  commands like `yarn lint`, `yarn test`, and `yarn build` unless you need a
  narrow workspace command.

## Runtime Setup

- Local development needs MongoDB and Redis.
- Install from the repo root with `yarn install --ignore-engines`; Cypress 15
  requires Node 20, while the current client path still targets Node 18.
- The backend is two separate processes:
  - `yarn start:server` starts Express/static/auth/API on port `8080`.
  - `yarn start:socket` starts Socket.IO on port `9000`.
- The client runs separately with `yarn start:client`.
- Client env values live in `client/.env.development` and expect the API at
  `http://localhost:8080` and Socket.IO at `http://localhost:9000`.

## Dependency Age

- The stack is old: React 16, Webpack 4, Material UI v4, Socket.IO v3,
  Mongoose 6, and `node-sass`.
- Be cautious with modern Node/npm changes. `node-sass` and the old CRA/Webpack
  toolchain are likely to be the first things to break.

## Socket.IO

- Socket protocol constants live in `client/src/lib/protocol.js` and are also
  imported by the server. Update protocol constants, client middleware, and
  server namespace handlers together.
- `Protocol.ERROR` intentionally maps to the literal event name `errorrr`.
  Do not casually rename it to `error`, which can collide with Socket.IO's own
  error behavior.
- Client socket connections are owned by Redux middleware in
  `client/src/store/middlewares/`, not by React components.
- Echo-style socket features often need separate incoming and outgoing events.
  Reusing one event for both directions can create infinite loops.

## Room State

- Room user state uses Mongoose `Map`s keyed by WCA numeric user ids converted
  to strings. Preserve that convention when reading or writing maps like
  `waitingFor`, `competing`, `banned`, `inRoom`, and `registered`.
- Room data is deliberately masked differently for lobby users and joined users
  in `server/socket/namespaces/rooms.js`.
- Normal rooms are marked stale with `expireAt` TTL when empty. Grand Prix rooms
  are timer-driven and have different lifecycle behavior.

## Auth And Sessions

- Express sessions are stored in MongoDB and shared with Socket.IO through
  `express-socket.io-session`.
- Client API requests use `credentials: 'include'`; auth, CORS, and socket
  changes need to preserve cookie behavior.
- WCA OAuth uses the `redirectUri` sent by the client. The mixed
  `callbackUrl`/`callbackURL` config spelling is not currently the source of
  truth for the auth redirect.

## Checks

- Tests are sparse. The server test script currently passes when no tests exist.
- The root pre-commit hook runs `yarn lint && yarn test`.
- Useful focused checks:
  - `yarn turbo run lint --filter=letscube-client`
  - `yarn turbo run test:ci --filter=letscube-client`
  - `yarn turbo run lint --filter=letscube-server`
  - `yarn turbo run test:ci --filter=letscube-server`
