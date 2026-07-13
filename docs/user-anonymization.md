# User anonymization

The admin page can permanently scrub a user's stored identity while retaining
their internal ID, room history, and solve history. Search for the account,
verify the displayed identifiers, and confirm the anonymization action. A later
WCA login does not restore identity data on an anonymized account.

If the admin page warns that the PostgreSQL scrub could not be confirmed, fix
the PostgreSQL connection and use **Reapply scrub** on the anonymized account.
The operation is idempotent and does not restore any removed data.

## WCA profile audit

The audit command is read-only. It checks users with stored WCA IDs against the
configured WCA origin and writes a private CSV containing only profiles that
returned HTTP 404. Network failures, rate limits, and other HTTP statuses are
printed as errors and are never treated as candidates.

Run the production audit inside the API container so it uses the deployed
MongoDB and WCA configuration. From the production repository root:

```sh
DOCKER_CONTEXT=default docker compose \
  -f compose.yml -f compose.prod.yml --env-file .env.prod \
  exec -T api node server/scripts/auditAnonymizedWcaUsers.js \
  --output /tmp/wca-anonymization-candidates.csv

DOCKER_CONTEXT=default docker compose \
  -f compose.yml -f compose.prod.yml --env-file .env.prod \
  cp api:/tmp/wca-anonymization-candidates.csv \
  ./wca-anonymization-candidates.csv

chmod 600 ./wca-anonymization-candidates.csv
```

Before reviewing the report, verify that the command printed
`https://www.worldcubeassociation.org` as its WCA origin. A successful audit
with any inconclusive lookup errors exits with status 2 after still writing the
candidate CSV, so inspect the printed error list separately.

The report includes internal ID, WCA ID, name, username, lookup status, and
reason; it excludes email and access tokens. Review every candidate manually in
the admin page before anonymizing the account. Set `WCA_AUDIT_DELAY_MS` only
when a different delay between requests is needed.
