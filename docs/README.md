# Let's Cube Documentation

This directory contains the durable technical documentation for Let's Cube.

## Guides

- [Architecture](architecture.md) — system topology, process boundaries, and
  request/data flow
- [Development](development.md) — local setup, commands, tests, and common
  development workflows
- [Realtime behavior](realtime.md) — Socket.IO namespaces, room lifecycle,
  reconnects, and result delivery
- [Data and migrations](data.md) — MongoDB, PostgreSQL, Prisma, metrics, and
  persistence guarantees
- [Production operations](operations.md) — deployment, health checks, rollback,
  backups, restore, and capacity management

## Feature contracts

- [Friendship and blocking lifecycle](friendships.md)
- [In-app social notifications](notifications.md)
- [Room and RaceSession contract](race-sessions.md) — durable room/session
  ownership, lifecycle, privacy, and migration rules

Package documentation:

- [`letscube-scrambles`](../packages/scrambles/README.md) — public exports,
  provider policy, and adding events

Repository-level documents:

- [Project overview](../README.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [Coding-agent guidance](../AGENTS.md)

## Documentation Ownership

Keep setup and contributor workflow in the development and contributing guides.
Put runtime and feature contracts in the closest technical guide or package
README. Put production procedures in the operations guide. Tests and code remain
the final authority when documentation and implementation disagree.

Do not use documentation files for active task status, issue triage, or backlog
planning; keep those in GitHub issues, milestones, and pull requests.
