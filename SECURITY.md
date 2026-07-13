# Security Policy

## Supported Version

Let's Cube is deployed continuously from `master`. Security fixes are made on
the current codebase; older commits and abandoned branches are not supported.

## Reporting A Vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting flow for
[`coder13/LetsCube`](https://github.com/coder13/LetsCube/security/advisories/new).
If that flow is unavailable, contact the repository owner privately and share
only enough information to establish a secure follow-up channel.

Please include:

- the affected endpoint or component;
- reproduction steps or a minimal proof of concept;
- the likely impact;
- any preconditions, such as authentication or room membership; and
- suggested mitigations, if known.

Avoid accessing data that is not yours, disrupting production traffic, or
publishing exploit details before a fix is available.

## Secrets And Sensitive Data

- Never commit `.env` files, OAuth credentials, session secrets, database
  passwords, TLS private keys, access tokens, or production backups.
- Use placeholders in examples and redact secrets from logs and screenshots.
- Use WCA staging credentials and non-production data for local testing.
- Treat room passwords, access codes, session cookies, OAuth data, email
  addresses, and production identifiers as sensitive.
- Production access should use individual authenticated accounts and the
  least privilege needed for the task.

See [Data and migrations](docs/data.md) for stored-data boundaries and
[Production operations](docs/operations.md) for backup and deployment safety.
