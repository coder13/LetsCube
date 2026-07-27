const { v4: uuidv4 } = require('uuid');
const { pool } = require('./index');
const { stableId } = require('./dualWrite');
const SqlQuery = require('./sqlQuery');

const RELATIONSHIP_STATUSES = Object.freeze({
  ACCEPTED: 'accepted', CANCELED: 'canceled', DECLINED: 'declined',
  PENDING: 'pending', REMOVED: 'removed',
});

const userId = (value) => stableId('user', value);
const relationshipRow = (row) => row && ({
  _id: row.id,
  pairKey: row.pair_key,
  lowUserId: Number(row.low_wca_user_id || row.low_user_id),
  highUserId: Number(row.high_wca_user_id || row.high_user_id),
  status: row.status,
  requestedBy: row.requested_by_wca_user_id === null || row.requested_by_wca_user_id === undefined
    ? undefined : Number(row.requested_by_wca_user_id),
  cooldownUntil: row.cooldown_until,
  revision: row.revision,
  stateChangedAt: row.state_changed_at,
  createdAt: row.source_created_at,
  updatedAt: row.source_updated_at,
});

const blockRow = (row) => row && ({
  _id: row.id,
  blockerId: Number(row.blocker_wca_user_id || row.blocker_id),
  blockedId: Number(row.blocked_wca_user_id || row.blocked_id),
  pairKey: row.pair_key,
  active: row.active,
  revision: row.revision,
  stateChangedAt: row.state_changed_at,
  createdAt: row.source_created_at,
  updatedAt: row.source_updated_at,
});

const relationshipSelect = `
  SELECT fr.*, low.wca_user_id AS low_wca_user_id, high.wca_user_id AS high_wca_user_id,
    req.wca_user_id AS requested_by_wca_user_id
  FROM app.friend_relationships fr
  JOIN app.users low ON low.id = fr.low_user_id
  JOIN app.users high ON high.id = fr.high_user_id
  LEFT JOIN app.users req ON req.id = fr.requested_by_user_id
`;
const blockSelect = `
  SELECT ub.*, blocker.wca_user_id AS blocker_wca_user_id, blocked.wca_user_id AS blocked_wca_user_id
  FROM app.user_blocks ub
  JOIN app.users blocker ON blocker.id = ub.blocker_id
  JOIN app.users blocked ON blocked.id = ub.blocked_id
`;

const relationshipWhere = (criteria, values, offset = 0) => {
  const clauses = [];
  if (criteria.pairKey) { values.push(criteria.pairKey); clauses.push(`fr.pair_key = $${values.length + offset}`); }
  if (criteria._id) { values.push(String(criteria._id)); clauses.push(`fr.id = $${values.length + offset}::uuid`); }
  if (criteria.revision !== undefined) { values.push(criteria.revision); clauses.push(`fr.revision = $${values.length + offset}`); }
  if (criteria.status?.$in) { values.push(criteria.status.$in); clauses.push(`fr.status = ANY($${values.length + offset}::text[])`); }
  const or = criteria.$or;
  if (or && or.length) {
    const parts = or.map((item) => {
      if (item.lowUserId !== undefined) { values.push(userId(item.lowUserId)); return `fr.low_user_id = $${values.length + offset}`; }
      if (item.highUserId !== undefined) { values.push(userId(item.highUserId)); return `fr.high_user_id = $${values.length + offset}`; }
      return 'FALSE';
    });
    clauses.push(`(${parts.join(' OR ')})`);
  }
  return clauses.length ? clauses.join(' AND ') : 'TRUE';
};

const blockWhere = (criteria, values) => {
  const clauses = [];
  if (criteria._id) { values.push(String(criteria._id)); clauses.push(`ub.id = $${values.length}::uuid`); }
  if (criteria.pairKey) { values.push(criteria.pairKey); clauses.push(`ub.pair_key = $${values.length}`); }
  if (criteria.blockerId !== undefined) { values.push(userId(criteria.blockerId)); clauses.push(`ub.blocker_id = $${values.length}`); }
  if (criteria.blockedId !== undefined) { values.push(userId(criteria.blockedId)); clauses.push(`ub.blocked_id = $${values.length}`); }
  if (criteria.active !== undefined) { values.push(criteria.active); clauses.push(`ub.active = $${values.length}`); }
  if (criteria.$or?.length) {
    const parts = criteria.$or.map((item) => {
      if (item.blockerId !== undefined) { values.push(userId(item.blockerId)); return `ub.blocker_id = $${values.length}`; }
      if (item.blockedId !== undefined) { values.push(userId(item.blockedId)); return `ub.blocked_id = $${values.length}`; }
      return 'FALSE';
    });
    clauses.push(`(${parts.join(' OR ')})`);
  }
  return clauses.length ? clauses.join(' AND ') : 'TRUE';
};

const updateFields = (update) => {
  const fields = [];
  const values = [];
  const set = update.$set || {};
  Object.entries(set).forEach(([key, value]) => {
    const column = {
      cooldownUntil: 'cooldown_until', requestedBy: 'requested_by_user_id',
      stateChangedAt: 'state_changed_at', status: 'status', active: 'active',
    }[key];
    if (!column) return;
    values.push(key === 'requestedBy' && value ? userId(value) : value);
    fields.push(`${column} = $${values.length}`);
  });
  if (update.$inc?.revision) fields.push(`revision = revision + ${Number(update.$inc.revision)}`);
  return { fields, values };
};

const createRelationshipModel = () => ({
  findOne: (criteria) => new SqlQuery(async () => {
    const values = [];
    const { rows } = await pool.query(`${relationshipSelect} WHERE ${relationshipWhere(criteria, values)} LIMIT 1`, values);
    return relationshipRow(rows[0]);
  }),
  find: (criteria) => new SqlQuery(async () => {
    const values = [];
    const { rows } = await pool.query(`${relationshipSelect} WHERE ${relationshipWhere(criteria, values)} ORDER BY fr.state_changed_at DESC`, values);
    return rows.map(relationshipRow);
  }),
  create: async (document) => {
    const now = document.stateChangedAt || new Date();
    const id = document._id || stableId('friend-relationship', document.pairKey);
    await pool.query(`
      INSERT INTO app.friend_relationships (
        id, pair_key, low_user_id, high_user_id, status, requested_by_user_id,
        cooldown_until, revision, state_changed_at, source_created_at, source_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9)
      RETURNING *
    `, [id, document.pairKey, userId(document.lowUserId), userId(document.highUserId), document.status,
      document.requestedBy ? userId(document.requestedBy) : null, document.cooldownUntil || null,
      document.revision || 0, now]);
    return createRelationshipModel().findOne({ _id: id });
  },
  findOneAndUpdate: async (criteria, update, options = {}) => {
    const changes = updateFields(update);
    if (!changes.fields.length) return createRelationshipModel().findOne(criteria);
    const offset = changes.values.length;
    const values = [];
    const where = relationshipWhere(criteria, values, offset);
    const updateResult = await pool.query(`UPDATE app.friend_relationships SET ${changes.fields.join(', ')}, source_updated_at = now(), ingested_at = now() WHERE ${where} RETURNING *`, [...changes.values, ...values]);
    if (!updateResult.rows[0] && options.upsert) return null;
    return createRelationshipModel().findOne({ _id: criteria._id });
  },
});

const createBlockModel = () => ({
  findOne: (criteria) => new SqlQuery(async () => {
    const values = [];
    const { rows } = await pool.query(`${blockSelect} WHERE ${blockWhere(criteria, values)} ORDER BY ub.revision DESC LIMIT 1`, values);
    return blockRow(rows[0]);
  }),
  find: (criteria) => new SqlQuery(async () => {
    const values = [];
    const { rows } = await pool.query(`${blockSelect} WHERE ${blockWhere(criteria, values)} ORDER BY ub.revision DESC`, values);
    return rows.map(blockRow);
  }),
  exists: (criteria) => new SqlQuery(async () => {
    const values = [];
    const { rows } = await pool.query(`SELECT 1 FROM app.user_blocks ub WHERE ${blockWhere(criteria, values)} LIMIT 1`, values);
    return !!rows[0];
  }),
  findOneAndUpdate: async (criteria, update, options = {}) => {
    const existing = await createBlockModel().findOne(criteria);
    const patch = update.$set || {};
    if (!existing && options.upsert) {
      const blocker = update.$setOnInsert.blockerId;
      const blocked = update.$setOnInsert.blockedId;
      const pairKey = update.$setOnInsert.pairKey;
      const { rows } = await pool.query(`
        INSERT INTO app.user_blocks (id, blocker_id, blocked_id, pair_key, active, revision, state_changed_at, source_created_at, source_updated_at)
        VALUES ($1, $2, $3, $4, $5, 1, $6, $6, $6)
        ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET active = EXCLUDED.active,
          revision = app.user_blocks.revision + 1, state_changed_at = EXCLUDED.state_changed_at,
          source_updated_at = EXCLUDED.source_updated_at, ingested_at = now()
        RETURNING *
      `, [stableId('user-block', `${blocker}:${blocked}`), userId(blocker), userId(blocked), pairKey,
        !!patch.active, patch.stateChangedAt || new Date()]);
      return blockRow(rows[0]);
    }
    if (!existing) return null;
    const changed = updateFields(update);
    if (!changed.fields.length) return existing;
    const values = [...changed.values, existing._id];
    const { rows } = await pool.query(`UPDATE app.user_blocks SET ${changed.fields.join(', ')}, source_updated_at = now(), ingested_at = now() WHERE id = $${values.length}::uuid RETURNING *`, values);
    return blockRow(rows[0]);
  },
});

const notificationRow = (row) => row && ({
  _id: row.id,
  id: row.id,
  actorId: Number(row.actor_wca_user_id),
  recipientId: Number(row.recipient_wca_user_id),
  type: row.type,
  sourceType: row.source_type,
  sourceId: row.source_id,
  dedupeKey: row.dedupe_key,
  readAt: row.read_at,
  expiresAt: row.expires_at,
  createdAt: row.source_created_at,
  updatedAt: row.source_updated_at,
});

const notificationWhere = (criteria, values) => {
  const clauses = ['sn.expires_at > now()'];
  if (criteria.recipientId !== undefined) { values.push(userId(criteria.recipientId)); clauses.push(`sn.recipient_wca_user_id = (SELECT wca_user_id FROM app.users WHERE id = $${values.length})`); }
  if (criteria.expiresAt?.$gt) { values.push(criteria.expiresAt.$gt); clauses.push(`sn.expires_at > $${values.length}`); }
  if (criteria.readAt === null) clauses.push('sn.read_at IS NULL');
  if (criteria.$or?.length) {
    const parts = criteria.$or.map((item) => {
      if (item.createdAt?.$lt) { values.push(item.createdAt.$lt); return `sn.source_created_at < $${values.length}`; }
      if (item.createdAt && item._id?.$lt) {
        values.push(item.createdAt, String(item._id));
        return `(sn.source_created_at = $${values.length - 1} AND sn.id < $${values.length}::uuid)`;
      }
      return 'FALSE';
    });
    clauses.push(`(${parts.join(' OR ')})`);
  }
  return clauses.join(' AND ');
};

const SocialNotification = {
  create: async (document) => {
    const id = uuidv4();
    const { rows } = await pool.query(`
      INSERT INTO app.social_notifications (
        id, mongo_id, recipient_wca_user_id, actor_wca_user_id, type, source_type,
        source_id, dedupe_key, expires_at, source_created_at, source_updated_at
      ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, now(), now())
      RETURNING *
    `, [id, document.recipientId, document.actorId, document.type, document.sourceType,
      String(document.sourceId), document.dedupeKey, document.expiresAt]);
    return notificationRow(rows[0]);
  },
  find: (criteria) => new SqlQuery(async ({ limit } = {}) => {
    const values = [];
    let sql = `SELECT * FROM app.social_notifications sn WHERE ${notificationWhere(criteria, values)} ORDER BY source_created_at DESC, id DESC`;
    if (limit !== undefined) { values.push(limit); sql += ` LIMIT $${values.length}`; }
    const { rows } = await pool.query(sql, values);
    return rows.map(notificationRow);
  }),
  countDocuments: async (criteria) => {
    const values = [];
    const { rows } = await pool.query(`SELECT count(*)::integer AS count FROM app.social_notifications sn WHERE ${notificationWhere(criteria, values)}`, values);
    return rows[0].count;
  },
  findOneAndUpdate: async (criteria, update) => {
    const values = [];
    const clauses = [`sn.id = $${values.length + 1}::uuid`];
    values.push(criteria._id);
    if (criteria.recipientId !== undefined) { values.push(criteria.recipientId); clauses.push(`sn.recipient_wca_user_id = $${values.length}`); }
    const set = update.$set || {};
    const fields = [];
    Object.entries(set).forEach(([key, value]) => { if (key === 'readAt') { values.push(value); fields.push(`read_at = $${values.length}`); } });
    if (!fields.length) return null;
    const { rows } = await pool.query(`UPDATE app.social_notifications sn SET ${fields.join(', ')}, source_updated_at = now(), ingested_at = now() WHERE ${clauses.join(' AND ')} RETURNING *`, values);
    return notificationRow(rows[0]);
  },
  updateMany: async (criteria, update) => {
    const values = [];
    const where = notificationWhere(criteria, values);
    values.push(update.$set.readAt);
    const result = await pool.query(`UPDATE app.social_notifications sn SET read_at = $${values.length}, source_updated_at = now(), ingested_at = now() WHERE ${where}`, values);
    return { modifiedCount: result.rowCount };
  },
};

module.exports = {
  FriendRelationship: createRelationshipModel(),
  RELATIONSHIP_STATUSES,
  SocialNotification,
  UserBlock: createBlockModel(),
};
