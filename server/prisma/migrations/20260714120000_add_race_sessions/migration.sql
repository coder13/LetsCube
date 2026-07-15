ALTER TABLE app.rooms
  ADD COLUMN kind text NOT NULL DEFAULT 'normal',
  ADD COLUMN competition_ref text;

UPDATE app.rooms
SET kind = CASE WHEN room_type = 'grand_prix' THEN 'competition' ELSE 'normal' END;

ALTER TABLE app.rooms
  ADD CONSTRAINT rooms_kind_check CHECK (kind IN ('normal', 'competition'));

CREATE TABLE app.race_sessions (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES app.rooms(id) ON DELETE RESTRICT,
  cube_event text NOT NULL,
  race_format text NOT NULL,
  scramble_source text NOT NULL,
  status text NOT NULL CHECK (status IN ('ready', 'racing', 'paused', 'ended', 'cancelled')),
  scheduled_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  current_attempt_ordinal integer CHECK (current_attempt_ordinal >= 0),
  next_solve_at timestamptz,
  source_key text NOT NULL UNIQUE,
  source_created_at timestamptz,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, room_id)
);

CREATE INDEX race_sessions_room_status_idx
  ON app.race_sessions (room_id, status, source_updated_at DESC);

CREATE TABLE app.session_participants (
  race_session_id uuid NOT NULL REFERENCES app.race_sessions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  eligible boolean NOT NULL DEFAULT true,
  competing boolean NOT NULL DEFAULT false,
  waiting_for boolean NOT NULL DEFAULT false,
  registered boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (race_session_id, user_id)
);

ALTER TABLE app.attempts
  ADD COLUMN race_session_id uuid;

ALTER TABLE app.attempts
  ADD CONSTRAINT attempts_id_room_id_key UNIQUE (id, room_id),
  ADD CONSTRAINT attempts_race_session_id_room_id_fkey
    FOREIGN KEY (race_session_id, room_id)
    REFERENCES app.race_sessions(id, room_id)
    ON DELETE RESTRICT;

CREATE INDEX attempts_race_session_ordinal_idx
  ON app.attempts (race_session_id, ordinal, id);

ALTER TABLE app.solves
  ADD COLUMN plus_two_penalty boolean NOT NULL DEFAULT false,
  ADD COLUMN submission_id text;

ALTER TABLE app.solves
  DROP CONSTRAINT solves_attempt_id_fkey,
  ADD CONSTRAINT solves_attempt_id_room_id_fkey
    FOREIGN KEY (attempt_id, room_id)
    REFERENCES app.attempts(id, room_id)
    ON DELETE RESTRICT;

CREATE INDEX solves_user_session_history_idx
  ON app.solves (user_id, source_created_at DESC, id DESC, attempt_id);
