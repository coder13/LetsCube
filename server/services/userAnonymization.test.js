/* eslint-env jest */

jest.mock('../runtimeConfig', () => ({ postgres: { enabled: true } }));
jest.mock('../postgres/dualWrite', () => ({ mirrorUser: jest.fn() }));

const { mirrorUser } = require('../postgres/dualWrite');

const {
  ANONYMOUS_NAME,
  anonymizeUser,
  publicAdminUser,
} = require('./userAnonymization');

describe('user anonymization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mirrorUser.mockResolvedValue('postgres-user-id');
  });

  it('removes stored identity while retaining the internal ID', async () => {
    const anonymizedAt = new Date('2026-07-12T12:00:00.000Z');
    const user = {
      id: 1234,
      name: 'Named User',
      username: 'solver',
      email: 'solver@example.com',
      wcaId: '2020TEST01',
      accessToken: 'secret',
      avatar: { url: 'avatar.png' },
      showWCAID: true,
      preferRealName: true,
      save: jest.fn(function save() { return Promise.resolve(this); }),
    };

    const result = await anonymizeUser(user, 8184, anonymizedAt);

    expect(result.alreadyAnonymized).toBe(false);
    expect(result.postgresMirrorFailed).toBe(false);
    expect(user).toEqual(expect.objectContaining({
      id: 1234,
      name: ANONYMOUS_NAME,
      avatar: {},
      showWCAID: false,
      preferRealName: false,
      anonymizedAt,
      anonymizedBy: 8184,
    }));
    expect(user.username).toBeUndefined();
    expect(user.email).toBeUndefined();
    expect(user.wcaId).toBeUndefined();
    expect(user.accessToken).toBeUndefined();
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(mirrorUser).toHaveBeenCalledWith(user);
  });

  it('is idempotent and does not expose an access token to the admin client', async () => {
    const user = {
      id: 1234,
      name: ANONYMOUS_NAME,
      anonymizedAt: new Date('2026-07-12T12:00:00.000Z'),
      accessToken: 'should-not-be-returned',
      save: jest.fn(),
    };

    const result = await anonymizeUser(user, 8184);

    expect(result.alreadyAnonymized).toBe(true);
    expect(user.save).not.toHaveBeenCalled();
    expect(mirrorUser).toHaveBeenCalledWith(user);
    expect(publicAdminUser(user)).not.toHaveProperty('accessToken');
  });

  it('reports an unconfirmed PostgreSQL scrub so it can be reapplied', async () => {
    const user = {
      id: 1234,
      name: ANONYMOUS_NAME,
      anonymizedAt: new Date('2026-07-12T12:00:00.000Z'),
    };
    mirrorUser.mockResolvedValue(null);

    const result = await anonymizeUser(user, 8184);

    expect(result.postgresMirrorFailed).toBe(true);
  });
});
