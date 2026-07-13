ALTER TABLE app.users
  ADD COLUMN anonymized_at timestamptz,
  ADD COLUMN anonymized_by_wca_user_id bigint;
