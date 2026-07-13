/** @jest-environment node */
/* eslint-env jest */

const { createRelationshipService } = require('./relationshipService');

const clone = (value) => (value ? JSON.parse(JSON.stringify(value)) : value);

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
      if (!filter.$or) {
        return relationship.requestedBy === filter.requestedBy
          && relationship.status === filter.status;
      }
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
    exists: jest.fn(async ({ active, pairKey }) => [...blocks.values()]
      .some((block) => block.pairKey === pairKey && block.active === active)),
    find: jest.fn(async (filter) => [...blocks.values()].filter((block) => (
      filter.$or.some((condition) => Object.entries(condition)
        .every(([key, value]) => block[key] === value))
      && block.active === filter.active
    )).map(clone)),
    findOne: jest.fn(async ({ blockerId, blockedId }) => clone(
      blocks.get(`${blockerId}:${blockedId}`),
    )),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const key = `${filter.blockerId}:${filter.blockedId}`;
      if (!blocks.has(key)) {
        if (!update.$setOnInsert) {
          return null;
        }
        blocks.set(key, {
          ...update.$setOnInsert,
          _id: `block-${sequence += 1}`,
          active: update.$set.active,
          revision: update.$inc.revision,
          stateChangedAt: update.$set.stateChangedAt,
          createdAt: update.$set.stateChangedAt,
          updatedAt: update.$set.stateChangedAt,
        });
      } else {
        const current = blocks.get(key);
        if (filter.active !== undefined && current.active !== filter.active) {
          return null;
        }
        blocks.set(key, {
          ...current,
          ...update.$set,
          revision: current.revision + update.$inc.revision,
          updatedAt: update.$set.stateChangedAt,
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
    mirrorRelationship: jest.fn().mockResolvedValue(null),
  };
  const notifier = jest.fn().mockResolvedValue(true);
  const notifications = {
    createFriendRequest: jest.fn().mockResolvedValue({ created: true }),
    createFriendRequestAccepted: jest.fn().mockResolvedValue({ created: true }),
  };
  const now = jest.fn(() => new Date('2026-07-12T12:00:00.000Z'));
  const requestLimiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const socialLogger = { error: jest.fn() };
  const service = createRelationshipService({
    ...models,
    metricRecorder,
    mirrors,
    notifier,
    notifications,
    now,
    requestLimiter,
    socialLogger,
  });
  return {
    ...models,
    metricRecorder,
    mirrors,
    notifier,
    notifications,
    now,
    requestLimiter,
    socialLogger,
    service,
  };
};

describe('relationship service', () => {
  it('stores one unordered pair and accepts a crossed request', async () => {
    const {
      notifications, relationships, service, users,
    } = createService();

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
    expect(notifications.createFriendRequest).toHaveBeenCalledTimes(1);
    expect(notifications.createFriendRequestAccepted).toHaveBeenCalledTimes(1);
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

    expect(relationships.get('1:2').status).toBe('removed');
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

    expect(relationships.get('1:2').status).toBe('removed');
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

    expect(relationships.get('1:2').status).toBe('removed');
    expect(mirrors.mirrorRelationship).toHaveBeenCalled();
    expect(mirrors.mirrorRelationship).toHaveBeenLastCalledWith(
      expect.objectContaining({ pairKey: '1:2', status: 'removed' }),
      expect.any(Array),
    );
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

  it('applies the request limiter only when creating a new request', async () => {
    const { requestLimiter, service, users } = createService();

    await service.sendRequest(users.get(1), 2);
    await service.sendRequest(users.get(1), 2);
    await service.sendRequest(users.get(2), 1);

    expect(requestLimiter.consume).toHaveBeenCalledTimes(1);
    expect(requestLimiter.consume).toHaveBeenCalledWith({ actorId: 1, pairKey: '1:2' });
  });

  it('fails closed before persistence when the request limiter is unavailable', async () => {
    const {
      mirrors, notifier, relationships, requestLimiter, service, users,
    } = createService();
    const unavailable = Object.assign(new Error('Redis unavailable'), {
      code: 'request_rate_limit_unavailable',
      statusCode: 503,
    });
    requestLimiter.consume.mockRejectedValueOnce(unavailable);

    await expect(service.sendRequest(users.get(1), 2)).rejects.toMatchObject({
      code: 'request_rate_limit_unavailable',
      statusCode: 503,
    });

    expect(relationships).toEqual(new Map());
    expect(mirrors.mirrorRelationship).not.toHaveBeenCalled();
    expect(notifier).not.toHaveBeenCalled();
  });

  it('keeps a block active when unblock cannot tombstone a hidden relationship', async () => {
    const {
      blocks, mirrors, relationshipModel, relationships, service, users,
    } = createService();
    await service.sendRequest(users.get(1), 2);
    await service.acceptRequest(users.get(2), 1);
    relationshipModel.findOneAndUpdate.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(service.block(users.get(1), 2)).rejects.toThrow('cleanup failed');
    expect(blocks.get('1:2').active).toBe(true);
    expect(relationships.get('1:2').status).toBe('accepted');

    relationshipModel.findOneAndUpdate.mockRejectedValueOnce(new Error('cleanup still failed'));
    await expect(service.unblock(users.get(1), 2)).rejects.toThrow('cleanup still failed');
    expect(blocks.get('1:2').active).toBe(true);
    expect(relationships.get('1:2').status).toBe('accepted');
    expect((await service.list(users.get(1))).friends).toEqual([]);

    await service.unblock(users.get(1), 2);
    expect(blocks.get('1:2').active).toBe(false);
    expect(relationships.get('1:2').status).toBe('removed');
    expect(mirrors.mirrorRelationship).toHaveBeenLastCalledWith(
      expect.objectContaining({ pairKey: '1:2', status: 'removed' }),
      expect.any(Array),
    );
    expect(mirrors.mirrorBlock).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: false, pairKey: '1:2' }),
      expect.any(Object),
      expect.any(Object),
    );
  });
});
