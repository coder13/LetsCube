# Normalized username migration

PostgreSQL is the user source of truth. Usernames are optional and use two
fields: `username` stores trimmed display casing, while `usernameNormalized`
stores the lowercase lookup key. The normalized value is intentionally not
returned by user serialization.

Valid new usernames contain 1–15 ASCII letters, numbers, underscores, or
hyphens. Empty input unsets both fields. Legacy invalid values are preserved but
left without a normalized key, so they are not discoverable until their owner
chooses a valid username. The privacy exception is an invalid value containing
an email marker (`@`) after NFKC canonicalization, which is removed instead of
retained. This includes compatibility forms such as fullwidth and small `@`.
Case-insensitive legacy collisions are reported for explicit resolution; the
migration never picks a winner or silently renames an account.

## Production order

Issue #191 / PR #192 is a hard prerequisite. Its WCA email scope removal and
data purge must remain in the branch and be deployed before username discovery.

1. Back up PostgreSQL and schedule a short maintenance window for username writes.
2. Apply the committed PostgreSQL migrations. The nullable
   `app.users.username_normalized` column and its unique index are additive, so
   the previous application version continues to run.
3. From the release checkout, audit PostgreSQL without changing data:

   ```bash
   yarn workspace letscube-server usernames:backfill
   ```

4. Save the JSON report. Resolve every reported collision with the account
   owners before rollout. Do not deploy username writes or discovery while any
   collision remains: index creation fails closed rather than leaving the name
   available for a third account to claim. Invalid raw values are deliberately
   omitted from the report, and email-like invalid values are removed rather
   than copied or logged.
5. After the collision report is empty, apply the idempotent PostgreSQL backfill:

   ```bash
   yarn workspace letscube-server usernames:backfill --apply --create-index
   ```

   The command verifies and updates only normalized PostgreSQL fields without
   printing stored values.
6. Run the dry-run command again. `pendingChanges`, `privacyRemoved`, and the
   collision report must all be empty or zero. The apply command must report
   zero MongoDB private values and zero PostgreSQL mismatches.
7. Deploy the API and verify a casing-only username change, a conflicting
   change (`409 USERNAME_TAKEN`), and an invalid change
(`400 INVALID_USERNAME`). PostgreSQL persists the normalized field with the user
update.

Do not enable username writes or the discovery endpoint from #82 until this
sequence and the #191 purge have completed successfully.

## Rollback

Do not drop the PostgreSQL index or column when rolling the application back.
Disable username discovery and username edits while an incompatible image is
serving.
