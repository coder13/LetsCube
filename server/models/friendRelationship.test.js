/** @jest-environment node */
/* eslint-env jest */

const { FriendRelationship, UserBlock } = require('./index');

describe('friend relationship models', () => {
  it('accepts a normalized relationship pair', async () => {
    const relationship = new FriendRelationship({
      pairKey: '1:2',
      lowUserId: 1,
      highUserId: 2,
      requestedBy: 1,
      revision: 0,
      stateChangedAt: new Date(),
      status: 'pending',
    });

    await expect(relationship.validate()).resolves.toBeUndefined();
  });

  it('rejects denormalized pairs and invalid request direction', async () => {
    const denormalized = new FriendRelationship({
      pairKey: '2:1',
      lowUserId: 2,
      highUserId: 1,
      requestedBy: 2,
      revision: 0,
      stateChangedAt: new Date(),
      status: 'pending',
    });
    const invalidRequester = new FriendRelationship({
      pairKey: '1:2',
      lowUserId: 1,
      highUserId: 2,
      requestedBy: 3,
      revision: 0,
      stateChangedAt: new Date(),
      status: 'pending',
    });

    await expect(denormalized.validate()).rejects.toThrow('normalized distinct pair');
    await expect(invalidRequester.validate()).rejects.toThrow('requester does not match');
  });

  it('accepts relationship and block tombstones with monotonic revisions', async () => {
    const removed = new FriendRelationship({
      pairKey: '1:2',
      lowUserId: 1,
      highUserId: 2,
      requestedBy: null,
      revision: 4,
      stateChangedAt: new Date(),
      status: 'removed',
    });
    const inactiveBlock = new UserBlock({
      active: false,
      pairKey: '1:2',
      blockerId: 1,
      blockedId: 2,
      revision: 2,
      stateChangedAt: new Date(),
    });

    await expect(removed.validate()).resolves.toBeUndefined();
    await expect(inactiveBlock.validate()).resolves.toBeUndefined();
  });

  it('rejects self-blocks and mismatched block pair keys', async () => {
    const selfBlock = new UserBlock({
      pairKey: '1:1',
      blockerId: 1,
      blockedId: 1,
    });
    const mismatchedPair = new UserBlock({
      pairKey: '2:1',
      blockerId: 1,
      blockedId: 2,
    });

    await expect(selfBlock.validate()).rejects.toThrow('cannot block themselves');
    await expect(mismatchedPair.validate()).rejects.toThrow('pair key does not match');
  });
});
