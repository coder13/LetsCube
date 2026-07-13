# Contributing to Let's Cube

Thank you for helping improve Let's Cube. Keep changes focused, preserve the
existing behavior outside the task, and include tests when behavior changes.

## Before You Start

Read the [development guide](docs/development.md) and the documentation for the
area being changed. The repository targets Node `22.17.0`, Yarn classic, and
Docker Compose.

Install dependencies once from the repository root:

```sh
nvm use
corepack enable
yarn install --frozen-lockfile
```

Do not run separate installs or create lockfiles inside workspaces.

## Branches

Create branches from the latest `master`:

```sh
git fetch origin
git switch -c your-branch origin/master
```

If you use a fork, replace `origin` with the remote that tracks the canonical
repository. Pull requests should target `master`.

Keep each pull request limited to one coherent change. Before publishing,
inspect both the commit list and the complete diff against `master` to make sure
the branch does not include work inherited from another feature branch.

## Code Style

- Follow the surrounding JavaScript and React patterns.
- The client and server use ESLint configurations based on Airbnb's style.
- Prefer small modules organized by responsibility over broad rewrites.
- Add comments only when they explain a non-obvious constraint or decision.
- Avoid unrelated formatting, dependency, or generated-file churn.

The repository contains modernized and legacy areas side by side. A change does
not need to modernize adjacent code unless that work is part of its purpose.

## Tests And Checks

Run focused checks while iterating:

```sh
yarn turbo run lint --filter=letscube-client
yarn turbo run test:ci --filter=letscube-client

yarn turbo run lint --filter=letscube-server
yarn turbo run test:ci --filter=letscube-server

yarn turbo run lint --filter=letscube-scrambles
yarn turbo run test:ci --filter=letscube-scrambles
```

Run the broad checks before requesting review when the change crosses workspace
boundaries:

```sh
yarn lint
yarn test
yarn build
```

Use `yarn cypress:run` for behavior that spans the browser, API, and Socket.IO
server. See [Development](docs/development.md#full-stack-cypress) for the local
stack expected by Cypress.

Every behavior change should have a test at the narrowest useful layer. UI
changes should include screenshots or a short recording in the pull request.

## Database Changes

PostgreSQL schema changes must be represented in Prisma and committed as a
migration. Validate them with:

```sh
yarn workspace letscube-server postgres:schema:validate
yarn workspace letscube-server postgres:migrate
yarn workspace letscube-server postgres:schema:check
```

Migrations must remain compatible with the previously deployed application
image because application rollback does not reverse database migrations. Read
[Data and migrations](docs/data.md) before changing persistence.

## Pull Requests

A pull request should include:

- the problem and intended behavior;
- a concise summary of the implementation;
- the checks that passed, failed, or were not run;
- migration, deployment, or compatibility considerations;
- screenshots for visible UI changes; and
- links to relevant issues.

Write commit subjects in the imperative mood. Include a short commit body that
explains what changed and why.

Do not include credentials, production data, access tokens, or private logs. If
you discover a vulnerability, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.
