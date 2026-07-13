/** @jest-environment node */
/* eslint-env jest */

jest.mock('./index', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const postgres = require('./index');
const {
  markRoomDeleted,
  mirrorBlock,
  mirrorBlockDeleted,
  mirrorMetricEvent,
  mirrorRelationship,
  mirrorRelationshipDeleted,
  mirrorRoom,
  mirrorRoomChanges,
  mirrorUser,
  stableId,
} = require('./dualWrite');

const user = {
  id: 1234,
  email: 'solver@example.com',
  name: 'Test Solver',
  username: 'solver',
  wcaId: '2026TEST01',
  accessToken: 'must-not-be-mirrored',
  showWCAID: true,
  preferRealName: false,
  useInspection: true,
  timerType: 'spacebar',
  muteTimer: false,
  avatar: { thumb: 'avatar.png' },
};

describe('PostgreSQL dual writer', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    postgres.withTransaction.mockImplementation((callback) => callback(client));
    postgres.query.mockResolvedValue({ rows: [] });
  });

  it('uses deterministic, domain-separated identifiers', () => {
    expect(stableId('user', 1234)).toBe(stableId('user', 1234));
    expect(stableId('user', 1234)).not.toBe(stableId('room', 1234));
  });

  it('mirrors users without copying OAuth access tokens', async () => {
    await mirrorUser(user);

    expect(client.query).toHaveBeenCalledTimes(1);
    const values = client.query.mock.calls[0][1];
    expect(values).toContain(1234);
    expect(values).toContain('solver@example.com');
    expect(values).not.toContain('must-not-be-mirrored');
  });

  it('mirrors a room snapshot, participants, attempts, and solves', async () => {
    const updatedAt = new Date('2026-07-09T20:00:00.000Z');
    const room = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Practice room',
      event: '333',
      accessCode: 'room-access-code',
      password: 'bcrypt-hash',
      type: 'normal',
      owner: user,
      admin: user,
      users: [user],
      competing: new Map([['1234', true]]),
      waitingFor: new Map([['1234', false]]),
      banned: new Map([['1234', false]]),
      inRoom: new Map([['1234', true]]),
      registered: new Map([['1234', true]]),
      attempts: [{
        _id: '507f1f77bcf86cd799439012',
        id: 0,
        scrambles: ['R U R\''],
        results: new Map([['1234', {
          time: -1,
          penalties: { DNF: true, inspection: true, AUF: false },
          createdAt: updatedAt,
          updatedAt,
        }]]),
        createdAt: updatedAt,
        updatedAt,
      }],
      requireRevealedIdentity: false,
      started: false,
      createdAt: updatedAt,
      updatedAt,
    };

    await mirrorRoom(room);

    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.users'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.rooms'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.room_participants'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.attempts'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.solves'))).toBe(true);

    const solveCall = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.solves'));
    expect(solveCall[0]).toContain('inspection_penalty');
    expect(solveCall[1].slice(4, 8)).toEqual([-1, true, true, false]);
    expect(solveCall[1]).not.toContain('room-access-code');
  });

  it('mirrors only explicitly changed attempts and results during live writes', async () => {
    const updatedAt = new Date('2026-07-09T20:00:00.000Z');
    const unrelatedUser = { id: 5678, name: 'Unchanged Solver' };
    const room = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Practice room',
      event: '333',
      accessCode: 'room-access-code',
      type: 'normal',
      owner: unrelatedUser,
      admin: unrelatedUser,
      users: [user, unrelatedUser],
      competing: new Map([['1234', true], ['5678', true]]),
      waitingFor: new Map([['1234', false], ['5678', true]]),
      banned: new Map([['1234', false], ['5678', false]]),
      inRoom: new Map([['1234', true], ['5678', true]]),
      registered: new Map([['1234', true], ['5678', true]]),
      attempts: [0, 1].map((id) => ({
        _id: `507f1f77bcf86cd79943901${id + 2}`,
        id,
        scrambles: ['R U R\''],
        results: new Map([['1234', {
          time: 12000 + id,
          penalties: {},
          createdAt: updatedAt,
          updatedAt,
        }]]),
        createdAt: updatedAt,
        updatedAt,
      })),
      requireRevealedIdentity: false,
      started: false,
      createdAt: updatedAt,
      updatedAt,
    };

    await mirrorRoomChanges(room, {
      attempts: [{
        attemptIndex: 1,
        resultUserIds: ['1234'],
        syncAllResults: false,
      }],
      participantUserIds: ['1234'],
    });

    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements.filter((sql) => sql.includes('INSERT INTO app.users'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO app.room_participants')))
      .toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO app.attempts'))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes('INSERT INTO app.solves'))).toHaveLength(1);
    expect(statements.some((sql) => sql.includes('DELETE FROM app.attempts'))).toBe(false);
    expect(client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.solves'))[1])
      .toContain(12001);
  });

  it('mirrors sanitized metric events and soft-deletes rooms', async () => {
    const occurredAt = new Date('2026-07-09T20:00:00.000Z');
    await mirrorMetricEvent({
      eventId: 'ad6bdef6-71f9-4264-b920-2b1e6ac061d5',
      event: 'room_joined',
      occurredAt,
      expiresAt: new Date('2026-10-07T20:00:00.000Z'),
      actorId: 'pseudonymous-user',
      roomId: 'pseudonymous-room',
      activeUserCount: 4,
    });
    await markRoomDeleted('507f1f77bcf86cd799439011');

    expect(postgres.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO analytics.events'),
      expect.arrayContaining(['room_joined', 'pseudonymous-user', 'pseudonymous-room']),
    );
    expect(postgres.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE app.rooms'),
      ['507f1f77bcf86cd799439011'],
    );
  });

  it('mirrors relationship revisions and directional blocks without graph metrics', async () => {
    const otherUser = {
      ...user,
      id: 5678,
      name: 'Other Solver',
      username: 'other',
      wcaId: '2026TEST02',
    };
    const updatedAt = new Date('2026-07-12T20:00:00.000Z');

    await mirrorRelationship({
      pairKey: '1234:5678',
      lowUserId: 1234,
      highUserId: 5678,
      requestedBy: 1234,
      status: 'pending',
      revision: 2,
      stateChangedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
    }, [user, otherUser]);
    await mirrorBlock({
      blockerId: 1234,
      blockedId: 5678,
      pairKey: '1234:5678',
      createdAt: updatedAt,
      updatedAt,
    }, user, otherUser);

    const statements = client.query.mock.calls.map(([sql]) => sql);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.friend_relationships')))
      .toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO app.user_blocks'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM app.friend_relationships')))
      .toBe(true);
  });

  it('makes mirror deletion idempotent and tolerates disabled PostgreSQL', async () => {
    await mirrorRelationshipDeleted('1234:5678');
    await mirrorBlockDeleted(1234, 5678);

    expect(postgres.query).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM app.friend_relationships WHERE pair_key = $1',
      ['1234:5678'],
    );
    expect(postgres.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM app.user_blocks'),
      [stableId('user', 1234), stableId('user', 5678)],
    );

    postgres.withTransaction.mockResolvedValueOnce(null);
    await expect(mirrorRelationship({ pairKey: '1234:5678' }, []))
      .resolves.toBeNull();
  });
});
