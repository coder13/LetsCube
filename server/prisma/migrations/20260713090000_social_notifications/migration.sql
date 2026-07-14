CREATE TABLE app.social_notifications (
    id uuid NOT NULL,
    mongo_id text NOT NULL,
    recipient_wca_user_id bigint NOT NULL,
    actor_wca_user_id bigint NOT NULL,
    type text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    dedupe_key text NOT NULL,
    read_at timestamptz(6),
    expires_at timestamptz(6) NOT NULL,
    source_created_at timestamptz(6),
    source_updated_at timestamptz(6) NOT NULL,
    ingested_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT social_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT social_notifications_distinct_users CHECK (recipient_wca_user_id <> actor_wca_user_id),
    CONSTRAINT social_notifications_type_source_check CHECK (
      (type IN ('friend_request', 'friend_request_accepted') AND source_type = 'friend_relationship')
      OR (type = 'room_invitation' AND source_type = 'room_invitation')
    )
);

CREATE UNIQUE INDEX social_notifications_mongo_id_key
ON app.social_notifications(mongo_id);

CREATE UNIQUE INDEX social_notifications_dedupe_key_key
ON app.social_notifications(dedupe_key);

CREATE INDEX social_notifications_recipient_read_created_idx
ON app.social_notifications(recipient_wca_user_id, read_at, source_created_at DESC, mongo_id DESC);

CREATE INDEX social_notifications_expiry_idx
ON app.social_notifications(expires_at);
