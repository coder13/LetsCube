/** @jest-environment node */
/* eslint-env jest */

jest.mock('./index', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const postgres = require('./index');
const {
  markRoomDeleted,
  mirrorMetricEvent,
  mirrorRoom,
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
          penalties: { plusTwo: false, DNF: true },
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
    expect(solveCall[1]).toContain(-1);
    expect(solveCall[1]).not.toContain('room-access-code');
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
});
