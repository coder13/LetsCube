ALTER TABLE app.solves
  DROP CONSTRAINT IF EXISTS solves_time_ms_check;

ALTER TABLE app.solves
  ADD CONSTRAINT solves_time_ms_check CHECK (time_ms >= -1);

DROP INDEX IF EXISTS app.users_username_lower_unique;

CREATE INDEX IF NOT EXISTS users_username_lower_idx
  ON app.users (lower(username))
  WHERE username IS NOT NULL AND username <> '';
