/** @jest-environment node */
/* eslint-env jest */

const {
  createCompetitionSession,
  ensureNormalSession,
  normalSession,
} = require('./service');

const session = (overrides = {}) => normalSession({
  id: 'initial-session',
  nextId: 'next-session',
  roomId: 'room-id',
  event: '333',
  sourceKey: 'legacy-normal:room',
  nextSourceKey: 'normal-session:room:333:next',
  sourceCreatedAt: new Date('2026-07-14T10:00:00.000Z'),
  sourceUpdatedAt: new Date('2026-07-14T10:00:00.000Z'),
  started: false,
  startTime: null,
  nextSolveAt: null,
  currentAttemptOrdinal: 0,
  ...overrides,
});

describe('RaceSession service', () => {
  it('creates the first normal session transactionally', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValue({}) };

    await expect(ensureNormalSession(client, session())).resolves.toBe('initial-session');

    expect(client.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FOR UPDATE'),
      expect.any(Array));
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO app.race_sessions'),
      expect.arrayContaining(['initial-session', 'room-id', '333']));
  });

  it('ends a normal session before creating the deterministic next event session', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'old-session', cube_event: '333', source_key: 'old' }] })
        .mockResolvedValue({}),
    };

    await expect(ensureNormalSession(client, session({ event: '222' }))).resolves.toBe('next-session');

    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining("status = 'ended'"),
      ['old-session', expect.any(Date)]);
    expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO app.race_sessions'),
      expect.arrayContaining(['next-session', '222', 'normal-session:room:333:next']));
  });

  it('creates competition sessions independently', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    const base = {
      roomId: 'competition-room', event: '333', sourceUpdatedAt: new Date(), sourceKey: 'competition:333',
    };

    await createCompetitionSession(client, { ...base, id: 'competition-333' });
    await createCompetitionSession(client, { ...base, id: 'competition-222', event: '222', sourceKey: 'competition:222' });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][1]).toEqual(expect.arrayContaining(['competition-333', '333', 'competition']));
    expect(client.query.mock.calls[1][1]).toEqual(expect.arrayContaining(['competition-222', '222', 'competition']));
  });
});
