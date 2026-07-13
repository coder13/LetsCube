ALTER TABLE app.users
  ADD COLUMN username_normalized text;

CREATE UNIQUE INDEX users_username_normalized_key
  ON app.users (username_normalized);
