CREATE TABLE app.friend_relationships (
    id uuid NOT NULL,
    pair_key text NOT NULL,
    low_user_id uuid NOT NULL,
    high_user_id uuid NOT NULL,
    status text NOT NULL,
    requested_by_user_id uuid,
    cooldown_until timestamptz(6),
    revision integer NOT NULL,
    state_changed_at timestamptz(6) NOT NULL,
    source_created_at timestamptz(6),
    source_updated_at timestamptz(6) NOT NULL,
    ingested_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT friend_relationships_pkey PRIMARY KEY (id),
    CONSTRAINT friend_relationships_distinct_users CHECK (low_user_id <> high_user_id),
    CONSTRAINT friend_relationships_status_check CHECK (
      status IN ('pending', 'accepted', 'declined', 'canceled')
    ),
    CONSTRAINT friend_relationships_requester_check CHECK (
      (status = 'accepted' AND requested_by_user_id IS NULL)
      OR (status <> 'accepted' AND requested_by_user_id IN (low_user_id, high_user_id))
    )
);

CREATE UNIQUE INDEX friend_relationships_pair_key_key
ON app.friend_relationships(pair_key);

CREATE INDEX friend_relationships_low_status_idx
ON app.friend_relationships(low_user_id, status);

CREATE INDEX friend_relationships_high_status_idx
ON app.friend_relationships(high_user_id, status);

CREATE INDEX friend_relationships_requester_status_idx
ON app.friend_relationships(requested_by_user_id, status);

ALTER TABLE app.friend_relationships
ADD CONSTRAINT friend_relationships_low_user_id_fkey
FOREIGN KEY (low_user_id) REFERENCES app.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE app.friend_relationships
ADD CONSTRAINT friend_relationships_high_user_id_fkey
FOREIGN KEY (high_user_id) REFERENCES app.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE app.friend_relationships
ADD CONSTRAINT friend_relationships_requested_by_user_id_fkey
FOREIGN KEY (requested_by_user_id) REFERENCES app.users(id) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE app.user_blocks (
    id uuid NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    pair_key text NOT NULL,
    source_created_at timestamptz(6),
    source_updated_at timestamptz(6) NOT NULL,
    ingested_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT user_blocks_distinct_users CHECK (blocker_id <> blocked_id)
);

CREATE UNIQUE INDEX user_blocks_blocker_blocked_key
ON app.user_blocks(blocker_id, blocked_id);

CREATE INDEX user_blocks_blocked_idx ON app.user_blocks(blocked_id);
CREATE INDEX user_blocks_pair_key_idx ON app.user_blocks(pair_key);

ALTER TABLE app.user_blocks
ADD CONSTRAINT user_blocks_blocker_id_fkey
FOREIGN KEY (blocker_id) REFERENCES app.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE app.user_blocks
ADD CONSTRAINT user_blocks_blocked_id_fkey
FOREIGN KEY (blocked_id) REFERENCES app.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
