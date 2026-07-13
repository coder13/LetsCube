# Let's Cube

Let's Cube is a progressive web app for racing other cubers in real time. It
combines a React client, an Express API, and a Socket.IO server with shared room
state and scramble generation.

The production site is [letscube.net](https://letscube.net).

## Repository Layout

- `client/` — React, Redux, Material UI, Vite, and the service worker
- `server/` — Express, authentication, Socket.IO, persistence, and metrics
- `packages/scrambles/` — shared event catalog and scramble provider
- `cypress/` — full-stack browser smoke tests
- `scripts/` — deployment, backup, restore, and deployment tests
- `docs/` — architecture, development, data, realtime, and operations guides

This is a Yarn classic workspace monorepo. Install dependencies from the root
and use the root `yarn.lock`.

## Quick Start

Prerequisites are Node `22.17.0`, Yarn `1.22.22`, Docker, and Docker Compose.

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
docker compose -f docker-compose.yml up -d
yarn workspace letscube-server postgres:migrate
```

Run the three application processes in separate terminals:

```sh
yarn start:client   # http://localhost:3000
yarn start:server   # http://localhost:8080
yarn start:socket   # http://localhost:9000
```

The default development configuration uses the WCA staging site. A real WCA
OAuth application is required to exercise the complete login flow.

See [Development](docs/development.md) for environment configuration, Docker
alternatives, tests, database migrations, and troubleshooting.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Realtime behavior](docs/realtime.md)
- [Data and migrations](docs/data.md)
- [Production operations](docs/operations.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Checks

```sh
yarn lint
yarn test
yarn build
```

The pre-commit hook runs lint and unit tests. Pull requests also run focused
client and server jobs plus a Cypress full-stack smoke test.

## License

Let's Cube is available under the terms in [LICENSE](LICENSE).
