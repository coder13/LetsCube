ALTER TABLE app.rooms
  ADD COLUMN IF NOT EXISTS membership_revision integer NOT NULL DEFAULT 0;

ALTER TABLE app.room_participants
  ADD COLUMN IF NOT EXISTS presence_revision integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS rooms_active_expiry_idx
  ON app.rooms (expires_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app.sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expire_idx ON app.sessions (expire);
