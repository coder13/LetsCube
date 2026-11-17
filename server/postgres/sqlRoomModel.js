const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { generateScramble } = require('letscube-scrambles');
const { pool } = require('./index');
const { stableId } = require('./dualWrite');
const { toUser } = require('./userRepository');
const SqlQuery = require('./sqlQuery');
const { LruCache } = require('../cache/lru');

const STALE_ROOM_LIFETIME_MS = 10 * 60 * 1000;
const roomCache = new LruCache({
  maxBytes: 128 * 1024 * 1024,
  ttlMs: 60 * 1000,
  estimateSize: (room) => Buffer.byteLength(JSON.stringify({
    id: room._id,
    users: room.users,
    attempts: room.attempts.map((attempt) => ({
      id: attempt._id,
      scrambles: attempt.scrambles,
      results: [...(attempt.results instanceof Map
        ? attempt.results.entries() : Object.entries(attempt.results || {}))],
    })),
    event: room.event,
  })),
});

const boolMap = (entries = []) => new Map(entries.map((entry) => [String(entry.userId), !!entry.value]));
const sameUser = (left, right) => left && right && String(left.id) === String(right.id);

const selectRoomAdmin = ({ usersInRoom, owner, admin }) => {
  if (!usersInRoom.length) return null;
  return usersInRoom.find((user) => sameUser(user, owner))
    || usersInRoom.find((user) => sameUser(user, admin))
    || usersInRoom[0];
};

const userRow = (row, prefix = '') => ({
  id: row[`${prefix}user_id`],
  wca_user_id: row[`${prefix}wca_user_id`],
  name: row[`${prefix}name`],
  username: row[`${prefix}username`],
  username_normalized: row[`${prefix}username_normalized`],
  wca_id: row[`${prefix}wca_id`],
  preferences: row[`${prefix}preferences`],
  avatar: row[`${prefix}avatar`],
});

const readUser = (row) => (row && row.wca_user_id !== null ? toUser(row) : null);

const externalRoomId = (value) => String(value && value._id !== undefined ? value._id : value);
const internalRoomId = (roomId) => stableId('room', externalRoomId(roomId));

const roomRowSql = (condition) => `
  SELECT r.*,
    ou.wca_user_id AS owner_wca_user_id, ou.name AS owner_name,
    ou.username AS owner_username, ou.username_normalized AS owner_username_normalized,
    ou.wca_id AS owner_wca_id, ou.preferences AS owner_preferences, ou.avatar AS owner_avatar,
    au.wca_user_id AS admin_wca_user_id, au.name AS admin_name,
    au.username AS admin_username, au.username_normalized AS admin_username_normalized,
    au.wca_id AS admin_wca_id, au.preferences AS admin_preferences, au.avatar AS admin_avatar
  FROM app.rooms r
  LEFT JOIN app.users ou ON ou.id = r.owner_id
  LEFT JOIN app.users au ON au.id = r.admin_id
  WHERE ${condition}
`;

const readRoom = async (id, { includeDeleted = false } = {}) => {
  const values = [externalRoomId(id), internalRoomId(id)];
  const deletedCondition = includeDeleted
    ? ''
    : ' AND r.deleted_at IS NULL AND (r.expires_at IS NULL OR r.expires_at > now())';
  const roomResult = await pool.query(`${roomRowSql(`(r.mongo_id = $1 OR r.id = $2)${deletedCondition}`)} LIMIT 1`, values);
  const row = roomResult.rows[0];
  if (!row) return null;

  const [participants, sessionResult] = await Promise.all([
    pool.query(`
      SELECT rp.*, u.id AS user_id, u.wca_user_id, u.name, u.username,
        u.username_normalized, u.wca_id, u.preferences, u.avatar
      FROM app.room_participants rp
      JOIN app.users u ON u.id = rp.user_id
      WHERE rp.room_id = $1
      ORDER BY u.wca_user_id
    `, [row.id]),
    pool.query(`
      SELECT * FROM app.race_sessions
      WHERE room_id = $1 AND status NOT IN ('ended', 'cancelled')
      ORDER BY source_updated_at DESC LIMIT 1
    `, [row.id]),
  ]);
  const session = sessionResult.rows[0] || null;
  const attemptResult = session
    ? await pool.query(`
      SELECT a.*, s.user_id AS solve_user_id, u.wca_user_id AS solve_wca_user_id,
        s.time_ms, s.dnf, s.plus_two_penalty, s.inspection_penalty, s.auf_penalty,
        s.submission_id, s.source_created_at AS solve_created_at
      FROM app.attempts a
      LEFT JOIN app.solves s ON s.attempt_id = a.id AND s.room_id = a.room_id
      LEFT JOIN app.users u ON u.id = s.user_id
      WHERE a.room_id = $1 AND a.race_session_id = $2
      ORDER BY a.ordinal, s.user_id
    `, [row.id, session.id])
    : { rows: [] };

  const users = participants.rows.map((participant) => readUser(userRow(participant)));
  const attemptsById = new Map();
  attemptResult.rows.forEach((attemptRow) => {
    let attempt = attemptsById.get(attemptRow.id);
    if (!attempt) {
      attempt = {
        _id: attemptRow.mongo_id,
        id: attemptRow.ordinal,
        scrambles: attemptRow.scrambles,
        results: new Map(),
        createdAt: attemptRow.source_created_at,
      };
      attemptsById.set(attemptRow.id, attempt);
    }
    if (attemptRow.solve_wca_user_id !== null) {
      attempt.results.set(String(attemptRow.solve_wca_user_id), {
        time: attemptRow.time_ms,
        penalties: {
          DNF: !!attemptRow.dnf,
          AUF: !!attemptRow.auf_penalty,
          inspection: !!attemptRow.inspection_penalty,
          ...(attemptRow.plus_two_penalty ? { plusTwo: true } : {}),
        },
        ...(attemptRow.submission_id ? { submissionId: attemptRow.submission_id } : {}),
        ...(attemptRow.solve_created_at ? { createdAt: attemptRow.solve_created_at } : {}),
      });
    }
  });

  const participantValues = participants.rows.map((participant) => ({
    userId: participant.wca_user_id,
    value: participant.in_room,
  }));
  const room = new RoomDocument({
    _id: row.mongo_id,
    id: row.id,
    name: row.name,
    event: session ? session.cube_event : row.cube_event,
    accessCode: row.access_code,
    password: row.password_hash,
    attempts: [...attemptsById.values()],
    users,
    waitingFor: boolMap(participants.rows.map((p) => ({ userId: p.wca_user_id, value: p.waiting_for }))),
    competing: boolMap(participants.rows.map((p) => ({ userId: p.wca_user_id, value: p.competing }))),
    banned: boolMap(participants.rows.map((p) => ({ userId: p.wca_user_id, value: p.banned }))),
    inRoom: boolMap(participantValues),
    registered: boolMap(participants.rows.map((p) => ({ userId: p.wca_user_id, value: p.registered }))),
    presenceRevision: new Map(participants.rows.map((p) => [String(p.wca_user_id), p.presence_revision || 0])),
    membershipRevision: row.membership_revision || 0,
    admin: readUser(userRow({
      user_id: row.admin_id,
      wca_user_id: row.admin_wca_user_id,
      name: row.admin_name,
      username: row.admin_username,
      username_normalized: row.admin_username_normalized,
      wca_id: row.admin_wca_id,
      preferences: row.admin_preferences,
      avatar: row.admin_avatar,
    })),
    owner: readUser(userRow({
      user_id: row.owner_id,
      wca_user_id: row.owner_wca_user_id,
      name: row.owner_name,
      username: row.owner_username,
      username_normalized: row.owner_username_normalized,
      wca_id: row.owner_wca_id,
      preferences: row.owner_preferences,
      avatar: row.owner_avatar,
    })),
    type: row.room_type,
    requireRevealedIdentity: row.require_revealed_identity,
    startTime: row.start_time,
    started: row.started,
    nextSolveAt: session ? session.next_solve_at : row.next_solve_at,
    expireAt: row.expires_at,
    twitchChannel: row.twitch_channel,
    _raceSessionId: session && session.id,
    _createdAt: row.source_created_at,
    _updatedAt: row.source_updated_at,
  });
  return room;
};

const loadRoom = async (id, options = {}) => {
  const key = externalRoomId(id);
  if (!options.includeDeleted) {
    const cached = roomCache.get(key);
    if (cached && (!cached.expireAt || new Date(cached.expireAt) > new Date())) return cached;
  }
  const room = await readRoom(id, options);
  if (room && !options.includeDeleted) roomCache.set(key, room);
  return room;
};

class RoomDocument {
  constructor(values = {}) {
    Object.assign(this, values);
    this._id = this._id || uuidv4();
    this.id = this.id || this._id;
    this.event = this.event || '333';
    this.accessCode = this.accessCode || uuidv4();
    this.type = this.type || 'normal';
    this.users = this.users || [];
    this.attempts = this.attempts || [];
    this.waitingFor = this.waitingFor || new Map();
    this.competing = this.competing || new Map();
    this.banned = this.banned || new Map();
    this.inRoom = this.inRoom || new Map();
    this.registered = this.registered || new Map();
    this.presenceRevision = this.presenceRevision || new Map();
    this.membershipRevision = this.membershipRevision || 0;
  }

  get usersInRoom() { return this.users.filter((user) => this.inRoom.get(String(user.id))); }
  get usersLength() { return this.usersInRoom.length; }
  get private() { return !!this.password; }
  get waitingForCount() { return [...this.waitingFor.values()].filter(Boolean).length; }
  get latestAttempt() { return this.attempts[this.attempts.length - 1]; }

  toObject() { return { ...this }; }

  async save() {
    await saveRoom(this);
    return this;
  }

  async authenticate(password) {
    return !!this.password && bcrypt.compare(password, this.password);
  }

  async genAttempt() {
    return {
      _id: uuidv4(),
      id: this.attempts.length,
      scrambles: [await generateScramble(this.event)],
      results: new Map(),
    };
  }

  async newAttempt() {
    const attempt = await this.genAttempt();
    this.attempts.push(attempt);
    this.usersInRoom.forEach((user) => this.waitingFor.set(String(user.id), !!this.competing.get(String(user.id))));
    return this.save();
  }

  async addUser(user, spectating) {
    const key = String(user.id);
    if (this.inRoom.get(key)) return false;
    if (!this.users.some((candidate) => String(candidate.id) === key)) {
      this.users.push(user);
      this.competing.set(key, this.type === 'normal');
    } else if (spectating) {
      this.competing.set(key, false);
    }
    this.inRoom.set(key, true);
    this.membershipRevision += 1;
    this.presenceRevision.set(key, (this.presenceRevision.get(key) || 0) + 1);
    if (!this.waitingForCount) this.waitingFor.set(key, true);
    if (this.type !== 'grand_prix' && (!this.attempts.length || this.latestAttempt.results.size > 0)) {
      await this.newAttempt();
    }
    this.expireAt = null;
    return this.save();
  }

  async dropUser(user) {
    const key = String(user.id);
    this.inRoom.set(key, false);
    this.waitingFor.set(key, false);
    this.membershipRevision += 1;
    this.presenceRevision.set(key, (this.presenceRevision.get(key) || 0) + 1);
    this.admin = selectRoomAdmin(this);
    if (!this.usersInRoom.length) {
      this.expireAt = new Date(Date.now() + STALE_ROOM_LIFETIME_MS);
    }
    return this.save();
  }

  async dropUserAtomically(user, expectedMembershipRevision, expectedPresenceRevision) {
    const key = String(user.id);
    if (!this.inRoom.get(key)
      || (expectedMembershipRevision !== undefined && expectedMembershipRevision !== this.membershipRevision)
      || (expectedPresenceRevision !== undefined && expectedPresenceRevision !== this.presenceRevision.get(key))) {
      return null;
    }
    const previousAdmin = this.admin;
    const room = await this.dropUser(user);
    return { room, adminChanged: !sameUser(previousAdmin, room.admin) };
  }

  async advancePresenceRevision(userId) {
    const key = String(userId);
    if (!this.inRoom.get(key)) return null;
    this.presenceRevision.set(key, (this.presenceRevision.get(key) || 0) + 1);
    return this.save();
  }

  async banUser(userId) { this.banned.set(String(userId), true); return this.dropUser({ id: userId }); }
  async unbanUser(userId) { this.banned.set(String(userId), false); return this.save(); }
  async updateRegistration(userId, value) { this.registered.set(String(userId), !!value); return this.save(); }
  async start() { this.started = true; this.users.forEach((u) => { if (this.registered.get(String(u.id))) this.competing.set(String(u.id), true); }); return this.save(); }
  async pause() { this.started = false; this.nextSolveAt = null; return this.save(); }
  async updateStale(stale) { this.expireAt = stale ? new Date(Date.now() + STALE_ROOM_LIFETIME_MS) : null; return this.save(); }
  doneWithScramble() {
    if (this.type === 'grand_prix' || !this.latestAttempt) return false;
    if (!this.usersInRoom.some((user) => this.latestAttempt.results.get(String(user.id)))) return false;
    return (this.waitingForCount === 0 || !this.attempts.length) && this.usersInRoom.length > 0;
  }
  async changeEvent(event) { this.event = event; this.attempts = []; this._raceSessionId = null; return this.newAttempt(); }
  async edit(options) {
    const unchanged = !!this.password && options.password === this.accessCode;
    if (options.private && !this.password && !options.password) throw Object.assign(new Error('A password is required to make a room private'), { statusCode: 400 });
    this.name = options.name;
    if (options.private && options.password && !unchanged) this.password = await bcrypt.hash(options.password, 10);
    if (!options.private) this.password = null;
    this.type = options.type;
    this.requireRevealedIdentity = options.requireRevealedIdentity;
    this.startTime = options.startTime;
    return this.save();
  }
  async updateAdminIfNeeded(callback) {
    const next = selectRoomAdmin(this);
    if (sameUser(this.admin, next) || (!this.admin && !next)) return this;
    this.admin = next;
    const room = await this.save();
    if (callback && room.admin) callback(room);
    return room;
  }
}

const saveRoom = async (room) => {
  const client = await pool.connect();
  const now = new Date();
  const roomUuid = internalRoomId(room._id);
  const ownerId = room.owner ? stableId('user', room.owner.id) : null;
  const adminId = room.admin ? stableId('user', room.admin.id) : null;
  const sessionId = room._raceSessionId || stableId('race-session', `${room._id}:${room.event}`);
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO app.rooms (
        id, mongo_id, name, cube_event, access_code, password_hash, room_type,
        owner_id, admin_id, require_revealed_identity, start_time, started,
        next_solve_at, expires_at, twitch_channel, source_created_at, source_updated_at,
        membership_revision
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, cube_event = EXCLUDED.cube_event, access_code = EXCLUDED.access_code,
        password_hash = EXCLUDED.password_hash, room_type = EXCLUDED.room_type,
        owner_id = EXCLUDED.owner_id, admin_id = EXCLUDED.admin_id,
        require_revealed_identity = EXCLUDED.require_revealed_identity, start_time = EXCLUDED.start_time,
        started = EXCLUDED.started, next_solve_at = EXCLUDED.next_solve_at,
        expires_at = EXCLUDED.expires_at, twitch_channel = EXCLUDED.twitch_channel,
        source_updated_at = EXCLUDED.source_updated_at, membership_revision = EXCLUDED.membership_revision,
        ingested_at = now()
    `, [roomUuid, room._id, room.name, room.event || '333', room.accessCode, room.password || null,
      room.type || 'normal', ownerId, adminId, !!room.requireRevealedIdentity, room.startTime || null,
      !!room.started, room.nextSolveAt || null, room.expireAt || null, room.twitchChannel || null,
      room._createdAt || now, now, room.membershipRevision || 0]);

    await client.query(`
      INSERT INTO app.race_sessions (
        id, room_id, cube_event, race_format, scramble_source, status, scheduled_start_at,
        started_at, current_attempt_ordinal, next_solve_at, source_key, source_created_at, source_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET cube_event = EXCLUDED.cube_event,
        status = EXCLUDED.status, scheduled_start_at = EXCLUDED.scheduled_start_at,
        started_at = COALESCE(app.race_sessions.started_at, EXCLUDED.started_at),
        current_attempt_ordinal = EXCLUDED.current_attempt_ordinal,
        next_solve_at = EXCLUDED.next_solve_at, source_updated_at = EXCLUDED.source_updated_at,
        ingested_at = now()
    `, [sessionId, roomUuid, room.event || '333', room.type === 'grand_prix' ? 'grand_prix' : 'normal',
      'letscube', room.started ? 'racing' : 'ready', room.startTime || null, room.started ? now : null,
      room.latestAttempt ? room.latestAttempt.id : null, room.nextSolveAt || null,
      `runtime:${room._id}:${room.event}`, room._createdAt || now, now]);

    for (const user of room.users) {
      const key = String(user.id);
      await client.query(`
        INSERT INTO app.room_participants (
          room_id, user_id, competing, waiting_for, banned, in_room, registered,
          presence_revision, source_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (room_id, user_id) DO UPDATE SET competing = EXCLUDED.competing,
          waiting_for = EXCLUDED.waiting_for, banned = EXCLUDED.banned, in_room = EXCLUDED.in_room,
          registered = EXCLUDED.registered, presence_revision = EXCLUDED.presence_revision,
          source_updated_at = EXCLUDED.source_updated_at, ingested_at = now()
      `, [roomUuid, stableId('user', user.id), !!room.competing.get(key), !!room.waitingFor.get(key),
        !!room.banned.get(key), !!room.inRoom.get(key), !!room.registered.get(key),
        room.presenceRevision.get(key) || 0, now]);

      await client.query(`
        INSERT INTO app.session_participants (
          race_session_id, user_id, eligible, competing, waiting_for, registered, source_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (race_session_id, user_id) DO UPDATE SET eligible = EXCLUDED.eligible,
          competing = EXCLUDED.competing, waiting_for = EXCLUDED.waiting_for,
          registered = EXCLUDED.registered, source_updated_at = EXCLUDED.source_updated_at,
          ingested_at = now()
      `, [sessionId, stableId('user', user.id), !room.banned.get(key), !!room.competing.get(key),
        !!room.waitingFor.get(key), !!room.registered.get(key), now]);
    }

    for (const attempt of room.attempts) {
      const attemptId = stableId('attempt', attempt._id || `${room._id}:${room.event}:${attempt.id}`);
      await client.query(`
        INSERT INTO app.attempts (
          id, mongo_id, room_id, race_session_id, ordinal, cube_event, scrambles,
          source_created_at, source_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
        ON CONFLICT (id) DO UPDATE SET scrambles = EXCLUDED.scrambles,
          source_updated_at = EXCLUDED.source_updated_at, ingested_at = now()
      `, [attemptId, attempt._id || `${room._id}:${room.event}:${attempt.id}`, roomUuid, sessionId,
        attempt.id, room.event || '333', JSON.stringify(attempt.scrambles || []), attempt.createdAt || now, now]);

      for (const [userId, result] of (attempt.results instanceof Map ? attempt.results.entries() : Object.entries(attempt.results || {}))) {
        const solveId = stableId('solve', `${attempt._id || attempt.id}:${userId}`);
        const penalties = result.penalties || {};
        await client.query(`
          INSERT INTO app.solves (
            id, attempt_id, room_id, user_id, time_ms, dnf, plus_two_penalty,
            inspection_penalty, auf_penalty, submission_id, source_created_at, source_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET time_ms = EXCLUDED.time_ms, dnf = EXCLUDED.dnf,
            plus_two_penalty = EXCLUDED.plus_two_penalty, inspection_penalty = EXCLUDED.inspection_penalty,
            auf_penalty = EXCLUDED.auf_penalty, submission_id = EXCLUDED.submission_id,
            source_updated_at = EXCLUDED.source_updated_at, ingested_at = now()
        `, [solveId, attemptId, roomUuid, stableId('user', userId), Math.round(result.time),
          !!penalties.DNF, !!penalties.plusTwo, !!penalties.inspection, !!penalties.AUF,
          result.submissionId || null, result.createdAt || now, now]);
      }
    }
    await client.query('COMMIT');
    room.id = roomUuid;
    room._raceSessionId = sessionId;
    room._updatedAt = now;
    roomCache.set(externalRoomId(room._id), room);
    return room;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const find = (criteria = {}) => new SqlQuery(async () => {
  const conditions = ['r.deleted_at IS NULL', '(r.expires_at IS NULL OR r.expires_at > now())'];
  const values = [];
  if (criteria.type) { values.push(criteria.type); conditions.push(`r.room_type = $${values.length}`); }
  const result = await pool.query(`${roomRowSql(conditions.join(' AND '))} ORDER BY r.source_updated_at DESC`, values);
  return Promise.all(result.rows.map((row) => loadRoom(row.mongo_id)));
});

const findById = (id) => new SqlQuery(() => loadRoom(id));

const deleteOne = async (criteria) => {
  const id = externalRoomId(criteria._id || criteria.id);
  const result = await pool.query(`
    UPDATE app.rooms SET deleted_at = now(), expires_at = NULL, ingested_at = now()
    WHERE mongo_id = $1 AND deleted_at IS NULL
  `, [id]);
  roomCache.delete(id);
  return { deletedCount: result.rowCount };
};

const Room = RoomDocument;
Room.find = find;
Room.findById = findById;
Room.deleteOne = deleteOne;
Room.isSqlRepository = true;
Room.cache = roomCache;

module.exports = { Room, RoomDocument, find, findById, loadRoom, saveRoom, selectRoomAdmin };
