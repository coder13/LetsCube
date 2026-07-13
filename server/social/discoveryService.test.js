/* eslint-env jest */

jest.mock('../models', () => ({
  FriendRelationship: {},
  User: {},
  UserBlock: {},
}));
jest.mock('./relationshipState', () => ({
  SocialError: class SocialError extends Error {
    constructor(statusCode, code, message, details = {}) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      Object.assign(this, details);
    }
  },
}));

const { createDiscoveryService } = require('./discoveryService');

const chain = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
  limit: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
});

const users = [
  {
    id: 2, name: 'Hidden Name', username: 'Cuber', usernameNormalized: 'cuber', showWCAID: false, wcaId: '2010CUBE01', avatar: { thumb_url: 'hidden' },
  },
  {
    id: 3, name: 'Visible Name', username: 'CuberTwo', usernameNormalized: 'cubertewo', showWCAID: true, wcaId: '2010CUBE02', avatar: { thumb_url: 'visible' },
  },
];

const createService = ({ blocks = [], relationships = [] } = {}) => {
  const userModel = {
    find: jest.fn(() => chain(users)),
    findOne: jest.fn((query) => Promise.resolve(users.find((user) => (
      (query.usernameNormalized && user.usernameNormalized === query.usernameNormalized)
      || (query.showWCAID && user.showWCAID && user.wcaId === query.wcaId)
    )) || null)),
  };
  const blockModel = { find: jest.fn(() => chain(blocks)) };
  const relationshipModel = {
    findOne: jest.fn(({ pairKey }) => Promise.resolve(
      relationships.find((entry) => entry.pairKey === pairKey) || null,
    )),
  };
  const searchLimiter = { consume: jest.fn().mockResolvedValue() };
  return {
    service: createDiscoveryService({
      blockModel, relationshipModel, searchLimiter, userModel,
    }),
    userModel,
    searchLimiter,
  };
};

describe('privacy-safe discovery', () => {
  it('returns the same empty result for email-like and invalid input without querying users', async () => {
    const { service, userModel, searchLimiter } = createService();

    await expect(service.search({ id: 1 }, 'name@example.com')).resolves.toEqual({ nextCursor: null, results: [] });
    await expect(service.search({ id: 1 }, 'not valid')).resolves.toEqual({ nextCursor: null, results: [] });

    expect(userModel.find).not.toHaveBeenCalled();
    expect(searchLimiter.consume).not.toHaveBeenCalled();
  });

  it('projects WCA identity only when the target opted in', async () => {
    const { service, userModel } = createService();

    const result = await service.search({ id: 1 }, 'cuber');

    expect(result.results).toEqual([
      expect.objectContaining({ id: 2, username: 'Cuber', displayName: 'Cuber' }),
      expect.objectContaining({ id: 3, username: 'CuberTwo', wcaId: '2010CUBE02' }),
    ]);
    expect(result.results[0]).not.toHaveProperty('wcaId');
    expect(result.results[0].avatar).toBeUndefined();
    await service.search({ id: 1 }, '2010cube02');
    expect(userModel.find).toHaveBeenLastCalledWith(expect.objectContaining({
      $and: expect.arrayContaining([expect.objectContaining({
        $or: expect.arrayContaining([{ showWCAID: true, wcaId: '2010CUBE02' }]),
      })]),
    }));
  });

  it('caps result pages and returns an opaque cursor', async () => {
    const { service } = createService();

    const result = await service.search({ id: 1 }, 'cuber', 1);

    expect(result.results).toHaveLength(1);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('omits either side of a block without explaining why', async () => {
    const { service } = createService({ blocks: [{ blockerId: 1, blockedId: 2, active: true }] });

    await expect(service.search({ id: 1 }, 'cuber')).resolves.toEqual({
      nextCursor: null,
      results: [expect.objectContaining({ id: 3 })],
    });
    await expect(service.publicProfile({ id: 1 }, 'cuber')).resolves.toBeNull();
  });

  it('returns viewer-relative safe actions and no editable/private fields', async () => {
    const { service } = createService({ relationships: [{ pairKey: '1:2', status: 'pending', requestedBy: 2 }] });

    const profile = await service.publicProfile({ id: 1 }, 'cuber');

    expect(profile).toEqual(expect.objectContaining({
      actions: ['accept', 'decline', 'block'],
      relationship: 'incoming',
    }));
    expect(profile).not.toHaveProperty('name');
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('accessToken');
  });

  it('returns unavailable for missing, email-like, or numeric identifiers', async () => {
    const { service } = createService();

    await expect(service.publicProfile({ id: 1 }, 'abc')).resolves.toBeNull();
    await expect(service.publicProfile({ id: 1 }, 'name@example.com')).resolves.toBeNull();
    await expect(service.publicProfile({ id: 1 }, '999')).resolves.toBeNull();
  });
});
