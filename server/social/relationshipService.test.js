/** @jest-environment node */
/* eslint-env jest */

const { createRelationshipService, MAX_OUTGOING_REQUESTS } = require('./relationshipService');

const clone = (value) => (value ? { ...value } : value);

const createModels = () => {
  const users = new Map([
    [1, {
      id: 1, name: 'One', username: 'one', email: 'private-one@example.com', preferRealName: false,
    }],
    [2, {
      id: 2, name: 'Two', username: 'two', email: 'private-two@example.com', preferRealName: false,
    }],
    [3, {
      id: 3, name: 'Three', username: 'three', email: 'private-three@example.com', preferRealName: false,
    }],
  ]);
  const relationships = new Map();
  const blocks = new Map();
  let sequence = 0;

  const relationshipModel = {
    countDocuments: jest.fn(async (filter) => [...relationships.values()].filter(
      (relationship) => relationship.requestedBy === filter.requestedBy
        && relationship.status === filter.status,
    ).length),
    create: jest.fn(async (relationship) => {
      if (relationships.has(relationship.pairKey)) {
        const err = new Error('duplicate pair');
        err.code = 11000;
        throw err;
      }
      const timestamp = new Date('2026-07-12T12:00:00.000Z');
      const created = {
        ...clone(relationship),
        _id: `relationship-${sequence += 1}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      relationships.set(created.pairKey, created);
      return clone(created);
    }),
    deleteOne: jest.fn(async (filter) => {
      const relationship = filter.pairKey
        ? relationships.get(filter.pairKey)
        : [...relationships.values()].find((entry) => entry._id === filter._id);
      if (!relationship || (filter.revision !== undefined
        && relationship.revision !== filter.revision)) {
        return { deletedCount: 0 };
      }
      relationships.delete(relationship.pairKey);
      return { deletedCount: 1 };
    }),
    find: jest.fn(async (filter) => [...relationships.values()].filter((relationship) => {
      const belongsToUser = filter.$or.some((condition) => Object.entries(condition)
        .every(([key, value]) => relationship[key] === value));
      return belongsToUser && filter.status.$in.includes(relationship.status);
    }).map(clone)),
    findOne: jest.fn(async ({ pairKey }) => clone(relationships.get(pairKey))),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const relationship = [...relationships.values()].find((entry) => entry._id === filter._id);
      if (!relationship || relationship.revision !== filter.revision) {
        return null;
      }
      const updated = {
        ...relationship,
        ...update.$set,
        revision: relationship.revision + update.$inc.revision,
        updatedAt: new Date('2026-07-12T12:00:00.000Z'),
      };
      relationships.set(updated.pairKey, updated);
      return clone(updated);
    }),
  };

  const blockModel = {
    deleteOne: jest.fn(async ({ blockerId, blockedId }) => ({
      deletedCount: blocks.delete(`${blockerId}:${blockedId}`) ? 1 : 0,
    })),
    exists: jest.fn(async ({ pairKey }) => [...blocks.values()]
      .some((block) => block.pairKey === pairKey)),
    find: jest.fn(async (filter) => [...blocks.values()].filter((block) => filter.$or
      .some((condition) => Object.entries(condition)
        .every(([key, value]) => block[key] === value))).map(clone)),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const key = `${filter.blockerId}:${filter.blockedId}`;
      if (!blocks.has(key)) {
        blocks.set(key, {
          ...update.$setOnInsert,
          _id: `block-${sequence += 1}`,
          updatedAt: update.$setOnInsert.createdAt,
        });
      }
      return clone(blocks.get(key));
    }),
  };

  const userModel = {
    find: jest.fn(async ({ id }) => id.$in.map((userId) => users.get(userId)).filter(Boolean)),
    findOne: jest.fn(async ({ id }) => clone(users.get(id))),
  };

  return {
    blockModel,
    blocks,
    relationshipModel,
    relationships,
    userModel,
    users,
  };
};

const createService = () => {
  const models = createModels();
  const metricRecorder = { recordSocialOutcome: jest.fn() };
  const mirrors = {
    mirrorBlock: jest.fn().mockResolvedValue(null),
    mirrorBlockDeleted: jest.fn().mockResolvedValue(null),
    mirrorRelationship: jest.fn().mockResolvedValue(null),
    mirrorRelationshipDeleted: jest.fn().mockResolvedValue(null),
  };
  const notifier = jest.fn().mockResolvedValue(true);
  const now = jest.fn(() => new Date('2026-07-12T12:00:00.000Z'));
  const service = createRelationshipService({
    ...models,
    metricRecorder,
    mirrors,
    notifier,
    now,
  });
  return {
    ...models,
    metricRecorder,
    mirrors,
    notifier,
    now,
    service,
  };
};

describe('relationship service', () => {
  it('stores one unordered pair and accepts a crossed request', async () => {
    const { relationships, service, users } = createService();

    await service.sendRequest(users.get(2), 1);
    await service.sendRequest(users.get(1), 2);

    expect(relationships.size).toBe(1);
    expect(relationships.get('1:2')).toEqual(expect.objectContaining({
      highUserId: 2,
      lowUserId: 1,
      pairKey: '1:2',
      requestedBy: null,
      status: 'accepted',
    }));
  });

  it('makes duplicate sends and concurrent accepts idempotent', async () => {
    const { relationships, service, users } = createService();

    await service.sendRequest(users.get(1), 2);
    const replay = await service.sendRequest(users.get(1), 2);
    const accepts = await Promise.all([
      service.acceptRequest(users.get(2), 1),
      service.acceptRequest(users.get(2), 1),
    ]);

    expect(replay.outcome).toBe('request_replayed');
    expect(accepts.map(({ outcome }) => outcome).sort()).toEqual([
      'accept_replayed',
      'request_accepted',
    ]);
    expect(relationships.get('1:2').status).toBe('accepted');
  });

  it('rejects self-actions, malformed ids, and unauthorized directions', async () => {
    const { service, users } = createService();

    await expect(service.sendRequest(users.get(1), 1)).rejects.toMatchObject({
      code: 'self_relationship',
      statusCode: 400,
    });
    await expect(service.sendRequest(users.get(1), 'not-an-id')).rejects.toMatchObject({
      code: 'invalid_user_id',
      statusCode: 400,
    });
    await expect(service.sendRequest(users.get(2), true)).rejects.toMatchObject({
      code: 'invalid_user_id',
      statusCode: 400,
    });
    await service.sendRequest(users.get(1), 2);
    await expect(service.acceptRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'invalid_relationship_transition',
      statusCode: 409,
    });
    await expect(service.acceptRequest(users.get(3), 2)).rejects.toMatchObject({
      code: 'invalid_relationship_transition',
      statusCode: 409,
    });
    await expect(service.sendRequest(users.get(1), 999999)).rejects.toMatchObject({
      code: 'relationship_unavailable',
      statusCode: 409,
    });
  });

  it('keeps declines idempotent and enforces the pair cooldown', async () => {
    const { now, service, users } = createService();

    await service.sendRequest(users.get(1), 2);
    await service.declineRequest(users.get(2), 1);
    await expect(service.declineRequest(users.get(2), 1)).resolves.toMatchObject({
      outcome: 'decline_replayed',
    });
    await expect(service.sendRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'request_cooldown',
      retryAfterSeconds: 24 * 60 * 60,
    });

    now.mockReturnValue(new Date('2026-07-13T12:00:01.000Z'));
    await expect(service.sendRequest(users.get(1), 2)).resolves.toMatchObject({
      outcome: 'request_created',
    });
  });

  it('keeps cancellations directional, replayable, and briefly rate limited', async () => {
    const { now, service, users } = createService();

    await service.sendRequest(users.get(1), 2);
    await expect(service.cancelRequest(users.get(2), 1)).rejects.toMatchObject({
      code: 'invalid_relationship_transition',
    });
    await service.cancelRequest(users.get(1), 2);
    await expect(service.cancelRequest(users.get(1), 2)).resolves.toMatchObject({
      outcome: 'cancel_replayed',
    });
    await expect(service.sendRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'request_cooldown',
      retryAfterSeconds: 60,
    });

    now.mockReturnValue(new Date('2026-07-12T12:01:01.000Z'));
    await expect(service.sendRequest(users.get(1), 2)).resolves.toMatchObject({
      outcome: 'request_created',
    });
  });

  it('lets a block win, hides its direction, and does not restore friendship on unblock', async () => {
    const {
      relationships, service, users,
    } = createService();

    await service.sendRequest(users.get(1), 2);
    await service.acceptRequest(users.get(2), 1);
    await service.block(users.get(1), 2);

    expect(relationships.has('1:2')).toBe(false);
    await expect(service.sendRequest(users.get(2), 1)).rejects.toMatchObject({
      code: 'relationship_unavailable',
    });
    const blockerView = await service.list(users.get(1));
    const blockedView = await service.list(users.get(2));
    expect(blockerView.blocked.map(({ user }) => user.id)).toEqual([2]);
    expect(blockedView.blocked).toEqual([]);
    expect(blockedView.friends).toEqual([]);

    await service.unblock(users.get(1), 2);
    expect((await service.list(users.get(1))).friends).toEqual([]);
    await expect(service.sendRequest(users.get(2), 1)).resolves.toMatchObject({
      outcome: 'request_created',
    });
  });

  it('removes a relationship when a block wins the write race', async () => {
    const {
      blockModel, relationships, service, users,
    } = createService();
    blockModel.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce({ _id: 'concurrent-block' });

    await expect(service.sendRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'relationship_unavailable',
    });

    expect(relationships.has('1:2')).toBe(false);
  });

  it('makes unfriend replayable and succeeds when PostgreSQL mirrors are disabled', async () => {
    const {
      mirrors, relationships, service, users,
    } = createService();

    await service.sendRequest(users.get(1), 2);
    await service.acceptRequest(users.get(2), 1);
    await service.unfriend(users.get(1), 2);
    await expect(service.unfriend(users.get(1), 2)).resolves.toMatchObject({
      outcome: 'unfriend_replayed',
    });

    expect(relationships.has('1:2')).toBe(false);
    expect(mirrors.mirrorRelationship).toHaveBeenCalled();
    expect(mirrors.mirrorRelationshipDeleted).toHaveBeenCalledWith('1:2');
  });

  it('returns only public fields and sends generic invalidations to both users', async () => {
    const { notifier, service, users } = createService();

    await service.sendRequest(users.get(1), 2);
    const snapshot = await service.list(users.get(1));

    expect(snapshot.outgoing[0].user).toEqual({
      displayName: 'two',
      id: 2,
      username: 'two',
    });
    expect(snapshot.outgoing[0].user).not.toHaveProperty('email');
    expect(notifier).toHaveBeenCalledWith({ userIds: [1, 2] });
  });

  it('enforces the pending outgoing request limit', async () => {
    const {
      relationshipModel, service, users,
    } = createService();
    relationshipModel.countDocuments.mockResolvedValue(MAX_OUTGOING_REQUESTS);

    await expect(service.sendRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'outgoing_request_limit',
      statusCode: 409,
    });
  });
});
