ALTER TABLE app.solves
  ADD COLUMN dnf boolean NOT NULL DEFAULT false,
  ADD COLUMN inspection_penalty boolean NOT NULL DEFAULT false,
  ADD COLUMN auf_penalty boolean NOT NULL DEFAULT false;

UPDATE app.solves
SET
  dnf = COALESCE((penalties ->> 'DNF')::boolean, false),
  inspection_penalty = COALESCE((penalties ->> 'inspection')::boolean, false),
  auf_penalty = COALESCE((penalties ->> 'AUF')::boolean, false),
  source_created_at = COALESCE(source_created_at, source_updated_at);

ALTER TABLE app.solves
  ALTER COLUMN source_created_at SET NOT NULL,
  DROP COLUMN penalties;

DROP INDEX app.solves_user_created_idx;

CREATE INDEX solves_user_created_idx
  ON app.solves (user_id, source_created_at DESC, id DESC);
