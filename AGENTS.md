# Let's Cube Agent Gotchas

This file is intentionally short. It captures repo-specific traps that are easy
to miss when making changes here.

## Project Layout

- This is a split Node app: `client/` and `server/` each have their own
  `package.json` and `package-lock.json`.
- The root `package.json` is only for Husky/pre-commit setup. Do not assume
  root scripts start, build, lint, or test the app.

## Runtime Setup

- Local development needs MongoDB and Redis.
- The backend is two separate processes from `server/`:
  - `npm run start:server` starts Express/static/auth/API on port `8080`.
  - `npm run start:socket` starts Socket.IO on port `9000`.
- The client runs separately from `client/` with `npm start`.
- Client env values live in `client/.env.development` and expect the API at
  `http://localhost:8080` and Socket.IO at `http://localhost:9000`.

## Dependency Age

- The stack is old: React 16, Webpack 4, Material UI v4, Socket.IO v3,
  Mongoose 5, and `node-sass`.
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

- Tests are sparse and client-only. The server has linting but no test script.
- The root pre-commit hook lints client and server, then runs client tests.
- Useful focused checks:
  - `cd client && npm run lint && npm test -- --watchAll=false`
  - `cd server && npm run lint`
