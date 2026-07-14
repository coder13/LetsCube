const ACTIVE_STATUSES = ['ready', 'racing', 'paused'];

const sessionStatus = ({ started, nextSolveAt }) => {
  if (started) {
    return 'racing';
  }
  if (nextSolveAt) {
    return 'paused';
  }
  return 'ready';
};

const createRaceSession = async (client, session) => {
  await client.query(`
    INSERT INTO app.race_sessions (
      id, room_id, cube_event, race_format, scramble_source, status,
      scheduled_start_at, started_at, ended_at, current_attempt_ordinal,
      next_solve_at, source_key, source_created_at, source_updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (source_key) DO UPDATE SET
      cube_event = EXCLUDED.cube_event,
      race_format = EXCLUDED.race_format,
      scramble_source = EXCLUDED.scramble_source,
      status = EXCLUDED.status,
      scheduled_start_at = EXCLUDED.scheduled_start_at,
      started_at = COALESCE(app.race_sessions.started_at, EXCLUDED.started_at),
      current_attempt_ordinal = EXCLUDED.current_attempt_ordinal,
      next_solve_at = EXCLUDED.next_solve_at,
      source_updated_at = EXCLUDED.source_updated_at,
      ingested_at = now()
    WHERE app.race_sessions.source_updated_at <= EXCLUDED.source_updated_at
  `, [
    session.id,
    session.roomId,
    session.event,
    session.format,
    session.scrambleSource,
    session.status,
    session.scheduledStartAt || null,
    session.startedAt || null,
    session.endedAt || null,
    session.currentAttemptOrdinal === undefined ? null : session.currentAttemptOrdinal,
    session.nextSolveAt || null,
    session.sourceKey,
    session.sourceCreatedAt || null,
    session.sourceUpdatedAt,
  ]);
  return session.id;
};

const endSession = async (client, sessionId, endedAt) => {
  await client.query(`
    UPDATE app.race_sessions
    SET status = 'ended',
        ended_at = COALESCE(ended_at, $2),
        source_updated_at = GREATEST(source_updated_at, $2),
        ingested_at = now()
    WHERE id = $1
  `, [sessionId, endedAt]);
};

const normalSession = ({
  id,
  nextId,
  roomId,
  event,
  sourceKey,
  nextSourceKey,
  sourceCreatedAt,
  sourceUpdatedAt,
  started,
  startTime,
  nextSolveAt,
  currentAttemptOrdinal,
}) => ({
  id,
  nextId,
  roomId,
  event,
  format: 'normal',
  scrambleSource: 'legacy_room',
  status: sessionStatus({ started, nextSolveAt }),
  scheduledStartAt: startTime,
  startedAt: started ? (startTime || sourceUpdatedAt) : null,
  nextSolveAt,
  currentAttemptOrdinal,
  sourceKey,
  nextSourceKey,
  sourceCreatedAt,
  sourceUpdatedAt,
});

const ensureNormalSession = async (client, desiredSession) => {
  const active = await client.query(`
    SELECT id, cube_event, source_key
    FROM app.race_sessions
    WHERE room_id = $1 AND status = ANY($2::text[])
    FOR UPDATE
  `, [desiredSession.roomId, ACTIVE_STATUSES]);
  const current = active.rows && active.rows[0];

  if (current && current.cube_event === desiredSession.event) {
    return createRaceSession(client, {
      ...desiredSession,
      id: current.id,
      sourceKey: current.source_key,
    });
  }

  if (current) {
    await endSession(client, current.id, desiredSession.sourceUpdatedAt);
  }

  return createRaceSession(client, current ? {
    ...desiredSession,
    id: desiredSession.nextId,
    sourceKey: desiredSession.nextSourceKey,
  } : desiredSession);
};

const createCompetitionSession = (client, session) => createRaceSession(client, {
  ...session,
  format: session.format || 'competition',
  scrambleSource: session.scrambleSource || 'competition',
  status: session.status || 'ready',
});

module.exports = {
  ACTIVE_STATUSES,
  createCompetitionSession,
  createRaceSession,
  ensureNormalSession,
  normalSession,
  sessionStatus,
};
