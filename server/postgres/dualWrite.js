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

const resultValue = (results, userId) => {
  if (!results) {
    return undefined;
  }
  if (typeof results.get === 'function') {
    return results.get(userId.toString());
  }
  return results[userId.toString()];
};

const upsertUser = async (client, user, fallbackUpdatedAt = new Date()) => {
  const wcaUserId = numericUserId(user);
  if (!wcaUserId || !user || !user.name) {
    return null;
  }

  const id = stableId('user', wcaUserId);
  const updatedAt = sourceDate(user.updatedAt, fallbackUpdatedAt);
  // Clear the compatibility column independently so a stale or identical
  // source timestamp cannot make the guarded upsert preserve a legacy value.
  await client.query(
    'UPDATE app.users SET email = NULL WHERE wca_user_id = $1 AND email IS NOT NULL',
    [wcaUserId],
  );
  await client.query(`
    INSERT INTO app.users (
      id, wca_user_id, name, username, username_normalized, wca_id,
      preferences, avatar, source_created_at, source_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (wca_user_id) DO UPDATE SET
      email = NULL,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      username_normalized = EXCLUDED.username_normalized,
      wca_id = EXCLUDED.wca_id,
      preferences = EXCLUDED.preferences,
      avatar = EXCLUDED.avatar,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    WHERE app.users.source_updated_at < EXCLUDED.source_updated_at
      OR (
        app.users.source_updated_at = EXCLUDED.source_updated_at
        AND ROW(
          app.users.name,
          app.users.username,
          app.users.username_normalized,
          app.users.wca_id,
          app.users.preferences,
          app.users.avatar
        ) IS DISTINCT FROM ROW(
          EXCLUDED.name,
          EXCLUDED.username,
          EXCLUDED.username_normalized,
          EXCLUDED.wca_id,
          EXCLUDED.preferences,
          EXCLUDED.avatar
        )
      )
  `, [
    id,
    wcaUserId,
    user.name,
    user.username || null,
    user.usernameNormalized || null,
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

const upsertRoomState = async (client, room, options = {}) => {
  if (!room || !room._id) {
    return null;
  }

  const roomId = stableId('room', room._id.toString());
  const updatedAt = sourceDate(room.updatedAt);
  const users = (room.users || []).filter((user) => numericUserId(user));
  const requestedUserIds = new Set((options.userIds || []).map(numericUserId).filter(Boolean));
  const requestedParticipantIds = new Set(
    (options.participantUserIds || []).map(numericUserId).filter(Boolean),
  );
  const participantUsers = options.syncAllParticipants
    ? users
    : users.filter((user) => requestedParticipantIds.has(numericUserId(user)));
  const requestedUsers = options.syncAllParticipants
    ? users
    : users.filter((user) => (
      requestedUserIds.has(numericUserId(user))
      || requestedParticipantIds.has(numericUserId(user))
    ));
  const roomUsers = options.syncRoomOwners || options.syncAllParticipants
    ? [room.owner, room.admin]
    : [];
  const relatedUsers = new Map();
  [...roomUsers, ...requestedUsers].forEach((user) => {
    const wcaUserId = numericUserId(user);
    if (wcaUserId) {
      relatedUsers.set(wcaUserId, user);
    }
  });
  const knownUserIds = new Set();

  for (const user of relatedUsers.values()) {
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
    WHERE app.rooms.source_updated_at < EXCLUDED.source_updated_at
      OR (
        app.rooms.source_updated_at = EXCLUDED.source_updated_at
        AND ROW(
          app.rooms.name,
          app.rooms.cube_event,
          app.rooms.access_code,
          app.rooms.password_hash,
          app.rooms.room_type,
          app.rooms.owner_id,
          app.rooms.admin_id,
          app.rooms.require_revealed_identity,
          app.rooms.start_time,
          app.rooms.started,
          app.rooms.next_solve_at,
          app.rooms.expires_at,
          app.rooms.twitch_channel,
          app.rooms.deleted_at
        ) IS DISTINCT FROM ROW(
          EXCLUDED.name,
          EXCLUDED.cube_event,
          EXCLUDED.access_code,
          EXCLUDED.password_hash,
          EXCLUDED.room_type,
          CASE WHEN $18 THEN EXCLUDED.owner_id ELSE app.rooms.owner_id END,
          CASE WHEN $19 THEN EXCLUDED.admin_id ELSE app.rooms.admin_id END,
          EXCLUDED.require_revealed_identity,
          EXCLUDED.start_time,
          EXCLUDED.started,
          EXCLUDED.next_solve_at,
          EXCLUDED.expires_at,
          EXCLUDED.twitch_channel,
          NULL
        )
      )
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

  for (const user of participantUsers) {
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
      WHERE app.room_participants.source_updated_at < EXCLUDED.source_updated_at
        OR (
          app.room_participants.source_updated_at = EXCLUDED.source_updated_at
          AND ROW(
            app.room_participants.competing,
            app.room_participants.waiting_for,
            app.room_participants.banned,
            app.room_participants.in_room,
            app.room_participants.registered
          ) IS DISTINCT FROM ROW(
            EXCLUDED.competing,
            EXCLUDED.waiting_for,
            EXCLUDED.banned,
            EXCLUDED.in_room,
            EXCLUDED.registered
          )
        )
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

  return {
    knownUserIds,
    roomId,
    updatedAt,
  };
};

const upsertAttempt = async (client, room, roomState, attempt, attemptIndex) => {
  const ordinal = Number.isInteger(attempt.id) ? attempt.id : attemptIndex;
  const attemptMongoId = attempt._id
    ? attempt._id.toString()
    : `${room._id}:${room.event}:${attempt.createdAt || roomState.updatedAt}:${ordinal}`;
  const attemptId = stableId('attempt', attemptMongoId);
  const attemptUpdatedAt = sourceDate(attempt.updatedAt, roomState.updatedAt);

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
    WHERE app.attempts.source_updated_at < EXCLUDED.source_updated_at
      OR (
        app.attempts.source_updated_at = EXCLUDED.source_updated_at
        AND ROW(
          app.attempts.ordinal,
          app.attempts.cube_event,
          app.attempts.scrambles
        ) IS DISTINCT FROM ROW(
          EXCLUDED.ordinal,
          EXCLUDED.cube_event,
          EXCLUDED.scrambles
        )
      )
  `, [
    attemptId,
    attemptMongoId,
    roomState.roomId,
    ordinal,
    room.event,
    JSON.stringify(attempt.scrambles || []),
    attempt.createdAt || null,
    attemptUpdatedAt,
  ]);

  return {
    attemptId,
    attemptMongoId,
    attemptUpdatedAt,
  };
};

const upsertSolve = async (client, roomState, attemptState, wcaUserId, result) => {
  if (!wcaUserId || !roomState.knownUserIds.has(wcaUserId) || !result) {
    return;
  }

  const penalties = result.penalties || {};
  const resultUpdatedAt = sourceDate(result.updatedAt, attemptState.attemptUpdatedAt);
  const resultCreatedAt = sourceDate(result.createdAt, resultUpdatedAt);

  await client.query(`
    INSERT INTO app.solves (
      id, attempt_id, room_id, user_id, time_ms, dnf,
      inspection_penalty, auf_penalty, source_created_at, source_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (attempt_id, user_id) DO UPDATE SET
      time_ms = EXCLUDED.time_ms,
      dnf = EXCLUDED.dnf,
      inspection_penalty = EXCLUDED.inspection_penalty,
      auf_penalty = EXCLUDED.auf_penalty,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    WHERE app.solves.source_updated_at < EXCLUDED.source_updated_at
      OR (
        app.solves.source_updated_at = EXCLUDED.source_updated_at
        AND ROW(
          app.solves.time_ms,
          app.solves.dnf,
          app.solves.inspection_penalty,
          app.solves.auf_penalty
        ) IS DISTINCT FROM ROW(
          EXCLUDED.time_ms,
          EXCLUDED.dnf,
          EXCLUDED.inspection_penalty,
          EXCLUDED.auf_penalty
        )
      )
  `, [
    stableId('solve', `${attemptState.attemptMongoId}:${wcaUserId}`),
    attemptState.attemptId,
    roomState.roomId,
    stableId('user', wcaUserId),
    result.time,
    !!penalties.DNF,
    !!penalties.inspection,
    !!penalties.AUF,
    resultCreatedAt,
    resultUpdatedAt,
  ]);
};

const syncAttemptResults = async (client, roomState, attemptState, attempt, userIds) => {
  for (const userKey of userIds) {
    const wcaUserId = numericUserId(userKey);
    if (!wcaUserId || !roomState.knownUserIds.has(wcaUserId)) {
      continue;
    }

    const result = resultValue(attempt.results, userKey);
    if (result) {
      await upsertSolve(client, roomState, attemptState, wcaUserId, result);
    } else {
      await client.query(`
        DELETE FROM app.solves
        WHERE attempt_id = $1 AND user_id = $2
      `, [attemptState.attemptId, stableId('user', wcaUserId)]);
    }
  }
};

const writeRoomChanges = async (client, room, changes) => {
  const resultUserIds = new Set();
  if (changes.replaceAttempts) {
    (room.attempts || []).forEach((attempt) => {
      resultEntries(attempt.results).forEach(([userId]) => resultUserIds.add(userId));
    });
  } else {
    (changes.attempts || []).forEach((change) => {
      if (change.syncAllResults) {
        const attempt = room.attempts && room.attempts[change.attemptIndex];
        resultEntries(attempt && attempt.results)
          .forEach(([userId]) => resultUserIds.add(userId));
      } else {
        (change.resultUserIds || []).forEach((userId) => resultUserIds.add(userId));
      }
    });
  }

  const roomState = await upsertRoomState(client, room, {
    participantUserIds: changes.participantUserIds,
    syncAllParticipants: changes.syncAllParticipants,
    syncRoomOwners: changes.syncRoomOwners,
    userIds: [...resultUserIds],
  });
  if (!roomState) {
    return null;
  }

  if (changes.replaceAttempts) {
    await client.query('DELETE FROM app.attempts WHERE room_id = $1', [roomState.roomId]);
    for (const [attemptIndex, attempt] of (room.attempts || []).entries()) {
      const attemptState = await upsertAttempt(client, room, roomState, attempt, attemptIndex);
      await syncAttemptResults(
        client,
        roomState,
        attemptState,
        attempt,
        resultEntries(attempt.results).map(([userId]) => userId),
      );
    }
    return roomState.roomId;
  }

  for (const change of changes.attempts || []) {
    const attempt = room.attempts && room.attempts[change.attemptIndex];
    if (!attempt) {
      continue;
    }

    const attemptState = await upsertAttempt(
      client,
      room,
      roomState,
      attempt,
      change.attemptIndex,
    );

    if (change.syncAllResults) {
      await client.query('DELETE FROM app.solves WHERE attempt_id = $1', [attemptState.attemptId]);
      await syncAttemptResults(
        client,
        roomState,
        attemptState,
        attempt,
        resultEntries(attempt.results).map(([userId]) => userId),
      );
    } else {
      await syncAttemptResults(
        client,
        roomState,
        attemptState,
        attempt,
        change.resultUserIds || [],
      );
    }
  }

  return roomState.roomId;
};

const mirrorRoomChanges = (room, changes = {}) => withTransaction(
  (client) => writeRoomChanges(client, room, changes),
);

// Full snapshots are reserved for explicit backfills and do not delete newer live rows.
const mirrorRoom = (room) => mirrorRoomChanges(room, {
  attempts: (room.attempts || []).map((attempt, attemptIndex) => ({
    attemptIndex,
    resultUserIds: resultEntries(attempt.results).map(([userId]) => userId),
    syncAllResults: false,
  })),
  syncAllParticipants: true,
  syncRoomOwners: true,
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
  mirrorRoomChanges,
  mirrorUser,
  numericUserId,
  stableId,
};
