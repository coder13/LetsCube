CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY,
  wca_user_id bigint NOT NULL UNIQUE,
  email text,
  name text NOT NULL,
  username text,
  wca_id text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  avatar jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_username_lower_idx
  ON app.users (lower(username))
  WHERE username IS NOT NULL AND username <> '';

CREATE TABLE IF NOT EXISTS app.rooms (
  id uuid PRIMARY KEY,
  mongo_id text NOT NULL UNIQUE,
  name text NOT NULL,
  cube_event text NOT NULL,
  access_code text NOT NULL UNIQUE,
  password_hash text,
  room_type text NOT NULL CHECK (room_type IN ('normal', 'grand_prix')),
  owner_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  require_revealed_identity boolean NOT NULL DEFAULT false,
  start_time timestamptz,
  started boolean NOT NULL DEFAULT false,
  next_solve_at timestamptz,
  expires_at timestamptz,
  twitch_channel text,
  deleted_at timestamptz,
  source_created_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.room_participants (
  room_id uuid NOT NULL REFERENCES app.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  competing boolean NOT NULL DEFAULT false,
  waiting_for boolean NOT NULL DEFAULT false,
  banned boolean NOT NULL DEFAULT false,
  in_room boolean NOT NULL DEFAULT false,
  registered boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS app.attempts (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES app.rooms(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  scrambles jsonb NOT NULL,
  source_created_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, ordinal)
);

CREATE TABLE IF NOT EXISTS app.solves (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES app.attempts(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES app.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  time_ms integer NOT NULL CHECK (time_ms >= 0),
  penalties jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, user_id)
);

CREATE INDEX IF NOT EXISTS solves_user_created_idx
  ON app.solves (user_id, source_created_at DESC);

CREATE INDEX IF NOT EXISTS attempts_room_ordinal_idx
  ON app.attempts (room_id, ordinal);

CREATE TABLE IF NOT EXISTS analytics.events (
  id uuid PRIMARY KEY,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_id text,
  room_id text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx
  ON analytics.events (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_room_time_idx
  ON analytics.events (room_id, occurred_at DESC)
  WHERE room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_events_expiry_idx
  ON analytics.events (expires_at);
