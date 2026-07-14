/** @jest-environment node */
/* eslint-env jest */

jest.mock('../metrics', () => ({ recordSolveHistoryRequest: jest.fn() }));
jest.mock('../postgres', () => ({ query: jest.fn() }));
jest.mock('../postgres/dualWrite', () => ({ stableId: (kind, id) => `${kind}:${id}` }));

const { recordSolveHistoryRequest } = require('../metrics');
const { createSolveHistoryRouter, decodeCursor } = require('./solveHistory');

const response = () => {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const handlerFor = (options) => createSolveHistoryRouter(options).stack[0].route.stack[0].handle;

describe('solve history API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps production exposure explicitly disabled', async () => {
    const res = response();
    await handlerFor({ enabled: false })({ query: {}, user: { id: 123 } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'feature_disabled' }));
  });

  it('returns only session-linked authorized PostgreSQL history with stable cursors', async () => {
    const postgresQuery = jest.fn().mockResolvedValue({ rows: [{
      solve_id: '4d8ce8c4-8910-47e9-b39f-79e1280c1e3a',
      time_ms: 12345,
      dnf: false,
      plus_two_penalty: true,
      inspection_penalty: false,
      auf_penalty: true,
      scrambles: ['R U'],
      room_id: 'ea1486ca-bce6-4c37-a4c9-1d32002c1e4a',
      race_session_id: '121ac5d8-19df-463a-af08-8b7b3c2c94a3',
      race_session_event: '333',
      completed_at: new Date('2026-07-14T10:00:00.000Z'),
      updated_at: new Date('2026-07-14T10:01:00.000Z'),
    }] });
    const res = response();

    await handlerFor({ enabled: true, postgresQuery })({ query: {}, user: { id: 123 } }, res);

    expect(postgresQuery.mock.calls[0][0]).toContain('rp.banned = false');
    expect(postgresQuery.mock.calls[0][0]).toContain('a.race_session_id');
    expect(postgresQuery.mock.calls[0][0]).not.toMatch(/email|access_code|password/i);
    expect(res.json).toHaveBeenCalledWith({
      solves: [expect.objectContaining({
        event: '333', timeMs: 12345, scramble: ['R U'],
        penalties: { dnf: false, plus2: true, inspection: false, auf: true },
        room: { id: 'ea1486ca-bce6-4c37-a4c9-1d32002c1e4a' },
        raceSession: { id: '121ac5d8-19df-463a-af08-8b7b3c2c94a3', event: '333' },
      })],
      nextCursor: null,
    });
    expect(recordSolveHistoryRequest).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success', count: 1,
    }));
  });

  it('returns 503 when PostgreSQL is unavailable and rejects malformed pagination', async () => {
    const unavailable = response();
    await handlerFor({ enabled: true, postgresQuery: jest.fn().mockResolvedValue(null) })(
      { query: {}, user: { id: 123 } }, unavailable,
    );
    expect(unavailable.status).toHaveBeenCalledWith(503);

    const invalid = response();
    await handlerFor({ enabled: true })({ query: { cursor: 'not-a-cursor' }, user: { id: 123 } }, invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
    expect(invalid.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_cursor' }));
    expect(() => decodeCursor('not-a-cursor')).toThrow('Invalid cursor');
  });
});
