const express = require('express');

const { isFeatureEnabled } = require('../features');
const { recordSolveHistoryRequest } = require('../metrics');
const { query } = require('../postgres');
const { stableId } = require('../postgres/dualWrite');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const invalidRequest = (code) => {
  const error = new Error(code === 'invalid_cursor' ? 'Invalid cursor' : 'Invalid limit');
  error.statusCode = 400;
  error.code = code;
  return error;
};

const encodeCursor = ({ completedAt, id }) => Buffer.from(JSON.stringify({
  completedAt: new Date(completedAt).toISOString(),
  id,
})).toString('base64url');

const decodeCursor = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value !== 'string' || value.length > 512) {
    throw invalidRequest('invalid_cursor');
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const completedAt = new Date(parsed.completedAt);
    if (!parsed || typeof parsed.id !== 'string' || !UUID.test(parsed.id)
      || Number.isNaN(completedAt.getTime())) {
      throw new Error('invalid');
    }
    return { completedAt, id: parsed.id };
  } catch {
    throw invalidRequest('invalid_cursor');
  }
};

const parseLimit = (value) => {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw invalidRequest('invalid_limit');
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw invalidRequest('invalid_limit');
  }
  return limit;
};

const asScramble = (scrambles) => {
  if (typeof scrambles !== 'string') {
    return scrambles;
  }
  try {
    return JSON.parse(scrambles);
  } catch {
    return scrambles;
  }
};

const historyQuery = `
  SELECT
    s.id AS solve_id,
    s.time_ms,
    s.dnf,
    s.plus_two_penalty,
    s.inspection_penalty,
    s.auf_penalty,
    s.source_created_at AS completed_at,
    s.source_updated_at AS updated_at,
    a.scrambles,
    r.id AS room_id,
    rs.id AS race_session_id,
    rs.cube_event AS race_session_event
  FROM app.solves s
  JOIN app.attempts a ON a.id = s.attempt_id AND a.room_id = s.room_id
  JOIN app.race_sessions rs ON rs.id = a.race_session_id AND rs.room_id = a.room_id
  JOIN app.rooms r ON r.id = s.room_id
  JOIN app.room_participants rp
    ON rp.room_id = r.id AND rp.user_id = $1 AND rp.banned = false
  WHERE s.user_id = $1
    AND ($2::timestamptz IS NULL OR (s.source_created_at, s.id) < ($2, $3::uuid))
  ORDER BY s.source_created_at DESC, s.id DESC
  LIMIT $4
`;

const solveResponse = (row) => ({
  id: row.solve_id,
  event: row.race_session_event,
  timeMs: row.time_ms,
  penalties: {
    dnf: !!row.dnf,
    plus2: !!row.plus_two_penalty,
    inspection: !!row.inspection_penalty,
    auf: !!row.auf_penalty,
  },
  scramble: asScramble(row.scrambles),
  room: { id: row.room_id },
  raceSession: { id: row.race_session_id, event: row.race_session_event },
  completedAt: new Date(row.completed_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const createSolveHistoryRouter = ({
  enabled = isFeatureEnabled('solveHistory'),
  postgresQuery = query,
  recordMetric = recordSolveHistoryRequest,
  now = () => Date.now(),
} = {}) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const startedAt = now();
    let outcome = 'error';
    let count = 0;
    try {
      if (!enabled) {
        outcome = 'feature_disabled';
        return res.status(404).json({
          code: 'feature_disabled',
          message: 'This feature is not available',
        });
      }

      const limit = parseLimit(req.query.limit);
      const cursor = decodeCursor(req.query.cursor);
      const numericId = Number(req.user && req.user.id);
      if (!Number.isSafeInteger(numericId) || numericId < 1) {
        outcome = 'unauthorized';
        return res.status(403).json({ code: 'unauthorized', message: 'Unauthorized' });
      }

      const result = await postgresQuery(historyQuery, [
        stableId('user', numericId),
        cursor && cursor.completedAt,
        cursor && cursor.id,
        limit + 1,
      ]);
      if (!result) {
        outcome = 'postgres_unavailable';
        return res.status(503).json({
          code: 'postgres_unavailable',
          message: 'Solve history is temporarily unavailable',
        });
      }

      const rows = result.rows || [];
      const hasNextPage = rows.length > limit;
      const page = rows.slice(0, limit);
      count = page.length;
      outcome = 'success';
      return res.json({
        solves: page.map(solveResponse),
        nextCursor: hasNextPage ? encodeCursor({
          completedAt: page[page.length - 1].completed_at,
          id: page[page.length - 1].solve_id,
        }) : null,
      });
    } catch (err) {
      if (err.statusCode === 400) {
        outcome = err.code;
        return res.status(400).json({ code: err.code, message: err.message });
      }
      outcome = 'postgres_unavailable';
      return res.status(503).json({
        code: 'postgres_unavailable',
        message: 'Solve history is temporarily unavailable',
      });
    } finally {
      Promise.resolve(recordMetric({
        outcome,
        count,
        latencyMs: Math.max(0, now() - startedAt),
      })).catch(() => {});
    }
  });

  return router;
};

module.exports = {
  createSolveHistoryRouter,
  decodeCursor,
  encodeCursor,
  parseLimit,
};
