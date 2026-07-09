ALTER TABLE app.attempts
  ADD COLUMN IF NOT EXISTS mongo_id text,
  ADD COLUMN IF NOT EXISTS cube_event text;

UPDATE app.attempts
SET mongo_id = id::text
WHERE mongo_id IS NULL;

UPDATE app.attempts
SET cube_event = rooms.cube_event
FROM app.rooms
WHERE app.attempts.room_id = rooms.id
  AND app.attempts.cube_event IS NULL;

ALTER TABLE app.attempts
  ALTER COLUMN mongo_id SET NOT NULL,
  ALTER COLUMN cube_event SET NOT NULL;

ALTER TABLE app.attempts
  DROP CONSTRAINT IF EXISTS attempts_room_id_ordinal_key;

CREATE UNIQUE INDEX IF NOT EXISTS attempts_mongo_id_unique
  ON app.attempts (mongo_id);
