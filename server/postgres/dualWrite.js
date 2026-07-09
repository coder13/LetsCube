/* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */
const { v4: uuidv4, v5: uuidv5 } = require('uuid');

const { query, withTransaction } = require('./index');

const DUAL_WRITE_NAMESPACE = uuidv5('https://letscube.net/postgres-dual-write', uuidv5.URL);

const stableId = (kind, value) => uuidv5(`${kind}:${value}`, DUAL_WRITE_NAMESPACE);

const numericUserId = (user) => {
  const value = typeof user === 'number' || typeof user === 'string' ? user : user && user.id;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const sourceDate = (value, fallback = new Date()) => {
  if (!value) {
    return fallback;
  }
  return value instanceof Date ? value : new Date(value);
};

const mapValue = (map, key) => {
  if (!map) {
    return false;
  }
  if (typeof map.get === 'function') {
    return !!map.get(key.toString());
  }
  return !!map[key.toString()];
};

const resultEntries = (results) => {
  if (!results) {
    return [];
  }
  if (typeof results.entries === 'function') {
    return [...results.entries()];
  }
  return Object.entries(results);
};

const upsertUser = async (client, user, fallbackUpdatedAt = new Date()) => {
  const wcaUserId = numericUserId(user);
  if (!wcaUserId || !user || !user.name) {
    return null;
  }

  const id = stableId('user', wcaUserId);
  const updatedAt = sourceDate(user.updatedAt, fallbackUpdatedAt);
  await client.query(`
    INSERT INTO app.users (
      id, wca_user_id, email, name, username, wca_id, preferences, avatar,
      source_created_at, source_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (wca_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      wca_id = EXCLUDED.wca_id,
      preferences = EXCLUDED.preferences,
      avatar = EXCLUDED.avatar,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    WHERE app.users.source_updated_at <= EXCLUDED.source_updated_at
  `, [
    id,
    wcaUserId,
    user.email || null,
    user.name,
    user.username || null,
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
    updatedAt,
  ]);

  return id;
};

const mirrorUser = (user) => withTransaction((client) => upsertUser(client, user));

const mirrorRoom = (room) => withTransaction(async (client) => {
  if (!room || !room._id) {
    return null;
  }

  const roomId = stableId('room', room._id.toString());
  const updatedAt = sourceDate(room.updatedAt);
  const users = (room.users || []).filter((user) => numericUserId(user));
  const relatedUsers = [room.owner, room.admin, ...users]
    .filter((user, index, all) => user && all.indexOf(user) === index);
  const knownUserIds = new Set();

  for (const user of relatedUsers) {
    const mirroredId = await upsertUser(client, user, updatedAt);
    if (mirroredId) {
      knownUserIds.add(numericUserId(user));
    }
  }

  const ownerWcaId = numericUserId(room.owner);
  const adminWcaId = numericUserId(room.admin);
  const ownerId = ownerWcaId && knownUserIds.has(ownerWcaId)
    ? stableId('user', ownerWcaId) : null;
  const adminId = adminWcaId && knownUserIds.has(adminWcaId)
    ? stableId('user', adminWcaId) : null;
  const ownerKnown = room.owner === null || !!ownerId;
  const adminKnown = room.admin === null || !!adminId;

  await client.query(`
    INSERT INTO app.rooms (
      id, mongo_id, name, cube_event, access_code, password_hash, room_type,
      owner_id, admin_id, require_revealed_identity, start_time, started,
      next_solve_at, expires_at, twitch_channel, source_created_at, source_updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
    )
    ON CONFLICT (mongo_id) DO UPDATE SET
      name = EXCLUDED.name,
      cube_event = EXCLUDED.cube_event,
      access_code = EXCLUDED.access_code,
      password_hash = EXCLUDED.password_hash,
      room_type = EXCLUDED.room_type,
      owner_id = CASE WHEN $18 THEN EXCLUDED.owner_id ELSE app.rooms.owner_id END,
      admin_id = CASE WHEN $19 THEN EXCLUDED.admin_id ELSE app.rooms.admin_id END,
      require_revealed_identity = EXCLUDED.require_revealed_identity,
      start_time = EXCLUDED.start_time,
      started = EXCLUDED.started,
      next_solve_at = EXCLUDED.next_solve_at,
      expires_at = EXCLUDED.expires_at,
      twitch_channel = EXCLUDED.twitch_channel,
      deleted_at = NULL,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    WHERE app.rooms.source_updated_at <= EXCLUDED.source_updated_at
  `, [
    roomId,
    room._id.toString(),
    room.name,
    room.event,
    room.accessCode,
    room.password || null,
    room.type,
    ownerId,
    adminId,
    !!room.requireRevealedIdentity,
    room.startTime || null,
    !!room.started,
    room.nextSolveAt || null,
    room.expireAt || null,
    room.twitchChannel || null,
    room.createdAt || null,
    updatedAt,
    ownerKnown,
    adminKnown,
  ]);

  for (const user of users) {
    const wcaUserId = numericUserId(user);
    if (!knownUserIds.has(wcaUserId)) {
      continue;
    }

    await client.query(`
      INSERT INTO app.room_participants (
        room_id, user_id, competing, waiting_for, banned, in_room, registered,
        source_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (room_id, user_id) DO UPDATE SET
        competing = EXCLUDED.competing,
        waiting_for = EXCLUDED.waiting_for,
        banned = EXCLUDED.banned,
        in_room = EXCLUDED.in_room,
        registered = EXCLUDED.registered,
        source_updated_at = EXCLUDED.source_updated_at,
        ingested_at = now()
      WHERE app.room_participants.source_updated_at <= EXCLUDED.source_updated_at
    `, [
      roomId,
      stableId('user', wcaUserId),
      mapValue(room.competing, wcaUserId),
      mapValue(room.waitingFor, wcaUserId),
      mapValue(room.banned, wcaUserId),
      mapValue(room.inRoom, wcaUserId),
      mapValue(room.registered, wcaUserId),
      updatedAt,
    ]);
  }

  for (const [attemptIndex, attempt] of (room.attempts || []).entries()) {
    const ordinal = Number.isInteger(attempt.id) ? attempt.id : attemptIndex;
    const attemptMongoId = attempt._id
      ? attempt._id.toString()
      : `${room._id}:${room.event}:${attempt.createdAt || updatedAt}:${ordinal}`;
    const attemptId = stableId('attempt', attemptMongoId);
    const attemptUpdatedAt = sourceDate(attempt.updatedAt, updatedAt);

    await client.query(`
      INSERT INTO app.attempts (
        id, mongo_id, room_id, ordinal, cube_event, scrambles,
        source_created_at, source_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (mongo_id) DO UPDATE SET
        ordinal = EXCLUDED.ordinal,
        cube_event = EXCLUDED.cube_event,
        scrambles = EXCLUDED.scrambles,
        source_updated_at = EXCLUDED.source_updated_at,
        ingested_at = now()
      WHERE app.attempts.source_updated_at <= EXCLUDED.source_updated_at
    `, [
      attemptId,
      attemptMongoId,
      roomId,
      ordinal,
      room.event,
      JSON.stringify(attempt.scrambles || []),
      attempt.createdAt || null,
      attemptUpdatedAt,
    ]);

    for (const [userKey, result] of resultEntries(attempt.results)) {
      const wcaUserId = numericUserId(userKey);
      if (!wcaUserId || !knownUserIds.has(wcaUserId) || !result) {
        continue;
      }

      const resultUpdatedAt = sourceDate(result.updatedAt, attemptUpdatedAt);
      await client.query(`
        INSERT INTO app.solves (
          id, attempt_id, room_id, user_id, time_ms, penalties,
          source_created_at, source_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (attempt_id, user_id) DO UPDATE SET
          time_ms = EXCLUDED.time_ms,
          penalties = EXCLUDED.penalties,
          source_updated_at = EXCLUDED.source_updated_at,
          ingested_at = now()
        WHERE app.solves.source_updated_at <= EXCLUDED.source_updated_at
      `, [
        stableId('solve', `${attemptMongoId}:${wcaUserId}`),
        attemptId,
        roomId,
        stableId('user', wcaUserId),
        result.time,
        result.penalties || {},
        result.createdAt || null,
        resultUpdatedAt,
      ]);
    }
  }

  return roomId;
});

const markRoomDeleted = (mongoId) => query(`
  UPDATE app.rooms
  SET deleted_at = now(), ingested_at = now()
  WHERE mongo_id = $1
`, [mongoId.toString()]);

const mirrorMetricEvent = (event) => query(`
  INSERT INTO analytics.events (
    id, event_name, occurred_at, actor_id, room_id, properties, expires_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (id) DO NOTHING
`, [
  event.eventId || uuidv4(),
  event.event,
  event.occurredAt,
  event.actorId || null,
  event.roomId || null,
  {
    actorType: event.actorType,
    roomType: event.roomType,
    cubeEvent: event.cubeEvent,
    privateRoom: event.privateRoom,
    failureReason: event.failureReason,
    leaveReason: event.leaveReason,
    activeUserCount: event.activeUserCount,
    roomSolveCount: event.roomSolveCount,
    durationMs: event.durationMs,
  },
  event.expiresAt,
]);

module.exports = {
  markRoomDeleted,
  mirrorMetricEvent,
  mirrorRoom,
  mirrorUser,
  numericUserId,
  stableId,
};
