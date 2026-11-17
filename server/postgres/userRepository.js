const { pool } = require('./index');
const { stableId } = require('./dualWrite');
const { normalizeUsername } = require('../username');

const numericId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const preferencesFromRow = (row) => ({
  showWCAID: !!row.preferences?.showWCAID,
  preferRealName: !!row.preferences?.preferRealName,
  useInspection: !!row.preferences?.useInspection,
  timerType: row.preferences?.timerType || 'spacebar',
  muteTimer: !!row.preferences?.muteTimer,
});

const toUser = (row) => {
  if (!row) return null;
  const preferences = preferencesFromRow(row);
  const user = {
    _id: row.id,
    id: Number(row.wca_user_id),
    name: row.name,
    username: row.username || undefined,
    usernameNormalized: row.username_normalized || undefined,
    wcaId: row.wca_id || undefined,
    avatar: row.avatar || {},
    ...preferences,
  };
  Object.defineProperties(user, {
    displayName: { enumerable: true, get: () => (user.preferRealName ? user.name : user.username) },
    canJoinRoom: { enumerable: true, get: () => user.preferRealName || !!user.username },
    toObject: { value: () => ({ ...user }), enumerable: false },
    save: { value: () => updateUser(user), enumerable: false },
  });
  return user;
};

const userParams = (user, fallbackName = 'Unknown User') => {
  const id = numericId(user.id);
  if (!id) throw new Error('A valid WCA user ID is required');
  const normalized = normalizeUsername(user.username);
  return [
    stableId('user', id),
    id,
    user.name || fallbackName,
    normalized.username || null,
    normalized.usernameNormalized || null,
    user.wcaId || null,
    {
      showWCAID: !!user.showWCAID,
      preferRealName: !!user.preferRealName,
      useInspection: !!user.useInspection,
      timerType: user.timerType || 'spacebar',
      muteTimer: !!user.muteTimer,
    },
    user.avatar || {},
    user.createdAt || null,
    new Date(),
  ];
};

const updateUser = async (user) => {
  const params = userParams(user);
  const { rows } = await pool.query(`
    INSERT INTO app.users (
      id, wca_user_id, name, username, username_normalized, wca_id,
      preferences, avatar, source_created_at, source_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
    ON CONFLICT (wca_user_id) DO UPDATE SET
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      username_normalized = EXCLUDED.username_normalized,
      wca_id = EXCLUDED.wca_id,
      preferences = EXCLUDED.preferences,
      avatar = EXCLUDED.avatar,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    RETURNING *
  `, params.map((value, index) => (index === 6 || index === 7 ? JSON.stringify(value) : value)));
  return toUser(rows[0]);
};

const findOne = async (criteria = {}) => {
  if (criteria._id !== undefined) {
    const { rows } = await pool.query('SELECT * FROM app.users WHERE id = $1::uuid LIMIT 1', [String(criteria._id)]);
    return toUser(rows[0]);
  }
  const users = await find(criteria, { limit: 1 });
  return users[0] || null;
};

const find = async (criteria = {}, { limit, offset = 0, order = 'wca_user_id ASC' } = {}) => {
  const values = [];
  const conditionSql = (entry) => {
    if (entry.$and) return entry.$and.map(conditionSql).filter(Boolean).join(' AND ') || 'TRUE';
    if (entry.$or) return `(${entry.$or.map(conditionSql).filter(Boolean).join(' OR ') || 'FALSE'})`;
    const parts = [];
    if (entry.id && entry.id.$in) {
      values.push(entry.id.$in.map(numericId));
      parts.push(`wca_user_id = ANY($${values.length}::bigint[])`);
    } else if (entry.id && entry.id.$ne !== undefined) {
      values.push(numericId(entry.id.$ne));
      parts.push(`wca_user_id <> $${values.length}`);
    } else if (entry.id !== undefined) {
      values.push(numericId(entry.id));
      parts.push(`wca_user_id = $${values.length}`);
    }
    if (entry.usernameNormalized && entry.usernameNormalized.$gte !== undefined) {
      values.push(entry.usernameNormalized.$gte, entry.usernameNormalized.$lt);
      parts.push(`username_normalized >= $${values.length - 1} AND username_normalized < $${values.length}`);
    } else if (entry.usernameNormalized !== undefined) {
      values.push(entry.usernameNormalized);
      parts.push(`username_normalized = $${values.length}`);
    }
    if (entry.showWCAID !== undefined) {
      values.push(!!entry.showWCAID);
      parts.push(`COALESCE((preferences->>'showWCAID')::boolean, false) = $${values.length}`);
    }
    if (entry.wcaId !== undefined) {
      values.push(entry.wcaId);
      parts.push(`wca_id = $${values.length}`);
    }
    return parts.join(' AND ');
  };
  const condition = conditionSql(criteria);
  const requestedOrder = typeof order === 'string'
    ? order
    : (order && order.usernameNormalized === 1 ? 'usernameNormalized 1' : '');
  const safeOrder = requestedOrder === 'usernameNormalized 1'
    || requestedOrder === 'username_normalized ASC'
    ? 'username_normalized ASC'
    : 'wca_user_id ASC';
  let sql = `SELECT * FROM app.users WHERE ${condition || 'TRUE'} ORDER BY ${safeOrder}`;
  if (limit !== undefined) {
    values.push(limit, offset);
    sql += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
  }
  const { rows } = await pool.query(sql, values);
  return rows.map(toUser);
};

const findOneAndUpdate = async (criteria, update, options = {}) => {
  const existing = await findOne(criteria);
  const patch = update.$set || update;
  if (!existing && !options.upsert) return null;
  const user = existing || { id: criteria.id, name: patch.name || 'Unknown User' };
  Object.assign(user, patch);
  return updateUser(user);
};

module.exports = {
  find,
  findOne,
  findOneAndUpdate,
  toUser,
  updateUser,
};
