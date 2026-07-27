const User = require('./sqlUserModel');
const { Room } = require('./sqlRoomModel');
const {
  FriendRelationship,
  RELATIONSHIP_STATUSES,
  SocialNotification,
  UserBlock,
} = require('./sqlSocialModels');
const { pool } = require('./index');

const metricRow = (row) => row && ({
  _id: row.id,
  id: row.id,
  ...row.properties,
  event: row.event_name,
  occurredAt: row.occurred_at,
  expiresAt: row.expires_at,
});

const metricWhere = (criteria, values) => {
  const clauses = [];
  const fields = { event: 'event_name', eventName: 'event_name' };
  Object.entries(fields).forEach(([key, column]) => {
    if (criteria[key] !== undefined) {
      values.push(criteria[key]);
      clauses.push(`${column} = $${values.length}`);
    }
  });
  [['actorId', 'actorId'], ['roomId', 'roomId']].forEach(([key, property]) => {
    if (criteria[key] !== undefined) {
      values.push(String(criteria[key]));
      clauses.push(`properties->>'${property}' = $${values.length}`);
    }
  });
  if (criteria.active !== undefined) {
    values.push(!!criteria.active);
    clauses.push(`COALESCE((properties->>'active')::boolean, false) = $${values.length}`);
  }
  return clauses.length ? clauses.join(' AND ') : 'TRUE';
};

const MetricEvent = {
  create: async (event) => {
    const { rows } = await pool.query(`
      INSERT INTO analytics.events (id, event_name, occurred_at, actor_id, room_id, properties, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, [event.eventId, event.event, event.occurredAt, event.actorId || null, event.roomId || null,
      JSON.stringify({ ...event }), event.expiresAt]);
    return rows[0] || null;
  },
  findOne: async (criteria) => {
    const values = [];
    const { rows } = await pool.query(`
      SELECT * FROM analytics.events WHERE ${metricWhere(criteria, values)}
      ORDER BY occurred_at DESC, id DESC LIMIT 1
    `, values);
    return metricRow(rows[0]);
  },
  findOneAndUpdate: async (criteria, update) => {
    const values = [];
    const where = metricWhere(criteria, values);
    const patch = JSON.stringify(update.$set || {});
    values.push(patch);
    const { rows } = await pool.query(`
      WITH target AS (
        SELECT id FROM analytics.events WHERE ${where}
        ORDER BY occurred_at DESC, id DESC LIMIT 1
      )
      UPDATE analytics.events e
      SET properties = e.properties || $${values.length}::jsonb
      FROM target WHERE e.id = target.id
      RETURNING e.*
    `, values);
    return metricRow(rows[0]);
  },
  updateMany: async (criteria, update) => {
    const values = [];
    const where = metricWhere(criteria, values);
    values.push(JSON.stringify(update.$set || {}));
    const result = await pool.query(`
      UPDATE analytics.events SET properties = properties || $${values.length}::jsonb
      WHERE ${where}
    `, values);
    return { modifiedCount: result.rowCount };
  },
};

const METRIC_EVENTS = Object.freeze({
  AUTH_FAILED: 'auth_failed',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_JOIN_FAILED: 'room_join_failed',
  ROOM_LEFT: 'room_left',
  ROOM_RESULT_SUBMITTED: 'room_result_submitted',
  SOLVE_HISTORY_REQUESTED: 'solve_history_requested',
  SOCIAL_ACTION: 'social_action',
});

module.exports = {
  Room,
  User,
  FriendRelationship,
  UserBlock,
  SocialNotification,
  RELATIONSHIP_STATUSES,
  MetricEvent,
  METRIC_EVENTS,
};
