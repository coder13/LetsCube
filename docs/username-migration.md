# Normalized username migration

MongoDB remains the user source of truth. Usernames are optional and use two
fields: `username` stores trimmed display casing, while `usernameNormalized`
stores the lowercase lookup key. The normalized value is intentionally not
returned by user serialization.

Valid new usernames contain 1–15 ASCII letters, numbers, underscores, or
hyphens. Empty input unsets both fields. Legacy invalid values are preserved but
left without a normalized key, so they are not discoverable until their owner
chooses a valid username. The privacy exception is an invalid value containing
an email marker (`@`), which is removed instead of retained. Case-insensitive
legacy collisions are also preserved and reported for explicit resolution; the
migration never picks a winner or silently renames an account.

## Production order

Issue #191 is a hard prerequisite. Merge and deploy its WCA email scope removal
and data purge before enabling username discovery.

1. Back up MongoDB and schedule a short maintenance window for username writes.
2. Apply the committed PostgreSQL migrations. The nullable
   `app.users.username_normalized` column and its unique index are additive, so
   the previous application version continues to run.
3. From the release checkout, audit MongoDB without changing data:

   ```bash
   yarn workspace letscube-server usernames:backfill
   ```

4. Save the JSON report. Resolve every reported collision with the account
   owners when practical. Invalid raw values are deliberately omitted from the
   report, and email-like invalid values are removed rather than copied or
   logged.
5. Apply the idempotent backfill and create or verify the sparse unique index:

   ```bash
   yarn workspace letscube-server usernames:backfill --apply --create-index
   ```

6. Run the dry-run command again. `pendingChanges` must be `0`; unresolved
   collision and invalid-value reports may remain because those users are
   intentionally undiscoverable.
7. Deploy the API and verify a casing-only username change, a conflicting
   change (`409 USERNAME_TAKEN`), and an invalid change
   (`400 INVALID_USERNAME`). PostgreSQL receives the normalized field through
   the existing non-blocking dual writer whenever MongoDB users are saved.

Do not enable the discovery endpoint from #82 until this sequence and the #191
purge have completed.

## Rollback

Do not drop the MongoDB index or PostgreSQL column when rolling the application
back. Both additions are backward-compatible and the previous application
ignores them. Disable username discovery and username edits while the old code
is serving because it does not maintain `usernameNormalized`. Before rolling
forward again, rerun the dry-run and apply commands to reconcile any writes made
by the old application.
