/* eslint-disable no-await-in-loop, no-continue */
const logger = require('../logger');
const metrics = require('../metrics');
const {
  FriendRelationship,
  RELATIONSHIP_STATUSES,
  User,
  UserBlock,
} = require('../models');
const {
  mirrorBlock,
  mirrorRelationship,
} = require('../postgres/dualWrite');
const { publishSocialInvalidation } = require('../realtime/socialEvents');
const notificationService = require('./notificationService');
const publicUserProjection = require('./publicUser');
const {
  ACTIONS,
  SocialError,
  transitionRelationship,
} = require('./relationshipState');
const { requestRateLimiter } = require('./requestRateLimiter');

const MAX_CAS_ATTEMPTS = 6;

const toPlain = (document) => {
  if (!document) {
    return null;
  }
  return typeof document.toObject === 'function' ? document.toObject() : document;
};

const lean = async (query) => {
  if (query && typeof query.lean === 'function') {
    return query.lean();
  }
  return query;
};

const normalizeUserId = (value) => {
  let userId = Number.NaN;
  if (typeof value === 'number') {
    userId = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    userId = Number(value);
  }
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new SocialError(400, 'invalid_user_id', 'A valid user id is required');
  }
  return userId;
};

const normalizedPair = (firstUserId, secondUserId) => {
  const lowUserId = Math.min(firstUserId, secondUserId);
  const highUserId = Math.max(firstUserId, secondUserId);
  return {
    highUserId,
    lowUserId,
    pairKey: `${lowUserId}:${highUserId}`,
  };
};

const createRelationshipService = ({
  blockModel = UserBlock,
  metricRecorder = metrics,
  requestLimiter = requestRateLimiter,
  relationshipModel = FriendRelationship,
  socialLogger = logger,
  userModel = User,
  mirrors = {
    mirrorBlock,
    mirrorRelationship,
  },
  notifier = publishSocialInvalidation,
  notifications = notificationService,
  now = () => new Date(),
} = {}) => {
  const runInBackground = (operation) => {
    Promise.resolve(operation).catch((err) => socialLogger.error(err));
  };

  const record = (userId, action, outcome) => runInBackground(
    metricRecorder.recordSocialOutcome({ userId, action, outcome }),
  );

  const invalidate = (userIds) => runInBackground(notifier({ userIds }));

  const loadUsers = async (actorUser, targetValue) => {
    const actorId = normalizeUserId(actorUser && actorUser.id);
    const targetId = normalizeUserId(targetValue);
    if (actorId === targetId) {
      throw new SocialError(400, 'self_relationship', 'Users cannot act on themselves');
    }

    const targetUser = await lean(userModel.findOne({ id: targetId }));
    if (!targetUser) {
      throw new SocialError(
        409,
        'relationship_unavailable',
        'The requested relationship action is not available',
      );
    }

    return {
      actorId,
      actorUser: toPlain(actorUser),
      pair: normalizedPair(actorId, targetId),
      targetId,
      targetUser: toPlain(targetUser),
    };
  };

  const pairIsBlocked = async (pairKey) => !!(await lean(blockModel.exists({
    active: true,
    pairKey,
  })));

  const persistTransition = async (current, transition) => {
    if (transition.kind === 'noop') {
      return current;
    }

    if (!current) {
      try {
        return toPlain(await relationshipModel.create({
          ...transition.relationship,
          revision: 0,
        }));
      } catch (err) {
        if (err.code === 11000) {
          return undefined;
        }
        throw err;
      }
    }

    const updated = await relationshipModel.findOneAndUpdate({
      _id: current._id,
      revision: current.revision,
    }, {
      $inc: { revision: 1 },
      $set: {
        cooldownUntil: transition.relationship.cooldownUntil,
        requestedBy: transition.relationship.requestedBy,
        stateChangedAt: transition.relationship.stateChangedAt,
        status: transition.relationship.status,
      },
    }, {
      new: true,
      useFindAndModify: false,
    });
    return updated ? toPlain(updated) : undefined;
  };

  const tombstoneRelationship = async (pair, changedAt) => {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const current = (await lean(relationshipModel.findOne({ pairKey: pair.pairKey }))) || null;
      if (!current || current.status === RELATIONSHIP_STATUSES.REMOVED) {
        return current;
      }
      const removed = await relationshipModel.findOneAndUpdate({
        _id: current._id,
        revision: current.revision,
      }, {
        $inc: { revision: 1 },
        $set: {
          cooldownUntil: null,
          requestedBy: null,
          stateChangedAt: changedAt,
          status: RELATIONSHIP_STATUSES.REMOVED,
        },
      }, {
        new: true,
        useFindAndModify: false,
      });
      if (removed) {
        return toPlain(removed);
      }
    }
    throw new SocialError(
      409,
      'relationship_conflict',
      'The relationship changed concurrently; reconcile and retry',
    );
  };

  const act = async (actorUser, targetValue, action) => {
    const {
      actorId, pair, targetId, targetUser,
    } = await loadUsers(actorUser, targetValue);

    if (await pairIsBlocked(pair.pairKey)) {
      record(actorId, action, 'unavailable');
      throw new SocialError(
        409,
        'relationship_unavailable',
        'The requested relationship action is not available',
      );
    }

    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const current = (await lean(relationshipModel.findOne({ pairKey: pair.pairKey }))) || null;
      let transition;
      try {
        transition = transitionRelationship({
          action,
          actorId,
          current,
          now: now(),
          pair,
          targetId,
        });

        if (action === ACTIONS.SEND && transition.outcome === 'request_created') {
          await requestLimiter.consume({ actorId, pairKey: pair.pairKey });
        }
      } catch (err) {
        record(actorId, action, err.code || 'error');
        throw err;
      }

      const persisted = await persistTransition(current, transition);
      if (persisted === undefined) {
        continue;
      }

      if (await pairIsBlocked(pair.pairKey)) {
        const removed = await tombstoneRelationship(pair, now());
        if (removed) {
          runInBackground(mirrors.mirrorRelationship(removed, [actorUser, targetUser]));
        }
        invalidate([actorId, targetId]);
        record(actorId, action, 'unavailable');
        throw new SocialError(
          409,
          'relationship_unavailable',
          'The requested relationship action is not available',
        );
      }

      if (transition.kind !== 'noop') {
        runInBackground(mirrors.mirrorRelationship(persisted, [actorUser, targetUser]));
      }
      if (transition.outcome === 'request_created') {
        await notifications.createFriendRequest({
          actor: actorUser,
          recipient: targetUser,
          relationship: persisted,
        });
      }
      if (transition.outcome === 'request_accepted'
        || transition.outcome === 'crossed_request_accepted') {
        await notifications.createFriendRequestAccepted({
          actor: actorUser,
          recipient: targetUser,
          relationship: persisted,
        });
      }
      if (transition.kind !== 'noop') {
        invalidate([actorId, targetId]);
      }
      record(actorId, action, transition.outcome);

      return {
        outcome: transition.outcome,
      };
    }

    record(actorId, action, 'conflict');
    throw new SocialError(
      409,
      'relationship_conflict',
      'The relationship changed concurrently; reconcile and retry',
    );
  };

  const block = async (actorUser, targetValue) => {
    const {
      actorId, pair, targetId, targetUser,
    } = await loadUsers(actorUser, targetValue);
    const blockedAt = now();
    const blockDocument = toPlain(await blockModel.findOneAndUpdate({
      blockedId: targetId,
      blockerId: actorId,
    }, {
      $inc: { revision: 1 },
      $set: {
        active: true,
        stateChangedAt: blockedAt,
      },
      $setOnInsert: {
        blockedId: targetId,
        blockerId: actorId,
        pairKey: pair.pairKey,
      },
    }, {
      new: true,
      setDefaultsOnInsert: true,
      upsert: true,
      useFindAndModify: false,
    }));

    const removed = await tombstoneRelationship(pair, blockedAt);
    runInBackground(mirrors.mirrorBlock(blockDocument, actorUser, targetUser));
    if (removed) {
      runInBackground(mirrors.mirrorRelationship(removed, [actorUser, targetUser]));
    }
    invalidate([actorId, targetId]);
    record(actorId, 'block', 'blocked');
    return { outcome: 'blocked' };
  };

  const unblock = async (actorUser, targetValue) => {
    const {
      actorId, pair, targetId, targetUser,
    } = await loadUsers(actorUser, targetValue);
    const removed = await tombstoneRelationship(pair, now());
    if (removed) {
      runInBackground(mirrors.mirrorRelationship(removed, [actorUser, targetUser]));
    }

    const deactivated = await blockModel.findOneAndUpdate({
      active: true,
      blockedId: targetId,
      blockerId: actorId,
    }, {
      $inc: { revision: 1 },
      $set: {
        active: false,
        stateChangedAt: now(),
      },
    }, {
      new: true,
      useFindAndModify: false,
    });
    const blockDocument = toPlain(deactivated || await lean(blockModel.findOne({
      blockedId: targetId,
      blockerId: actorId,
    })));
    if (blockDocument) {
      runInBackground(mirrors.mirrorBlock(blockDocument, actorUser, targetUser));
    }
    invalidate([actorId, targetId]);
    record(actorId, 'unblock', 'unblocked');
    return { outcome: 'unblocked' };
  };

  const list = async (actorUser) => {
    const actorId = normalizeUserId(actorUser && actorUser.id);
    const [relationships, blocks] = await Promise.all([
      lean(relationshipModel.find({
        $or: [{ lowUserId: actorId }, { highUserId: actorId }],
        status: { $in: [RELATIONSHIP_STATUSES.ACCEPTED, RELATIONSHIP_STATUSES.PENDING] },
      })),
      lean(blockModel.find({
        active: true,
        $or: [{ blockedId: actorId }, { blockerId: actorId }],
      })),
    ]);
    const blockedPairKeys = new Set(blocks.map((entry) => entry.pairKey));
    const visibleRelationships = relationships.filter(
      (relationship) => !blockedPairKeys.has(relationship.pairKey),
    );
    const ownBlocks = blocks.filter((entry) => entry.blockerId === actorId);
    const relatedUserIds = new Set(ownBlocks.map((entry) => entry.blockedId));
    visibleRelationships.forEach((relationship) => {
      relatedUserIds.add(
        relationship.lowUserId === actorId
          ? relationship.highUserId : relationship.lowUserId,
      );
    });
    const users = await lean(userModel.find({ id: { $in: [...relatedUserIds] } }));
    const usersById = new Map(users.map((user) => [user.id, publicUserProjection(user)]));
    const response = {
      blocked: [],
      friends: [],
      incoming: [],
      outgoing: [],
      reconciledAt: now(),
    };

    visibleRelationships.forEach((relationship) => {
      const otherId = relationship.lowUserId === actorId
        ? relationship.highUserId : relationship.lowUserId;
      const user = usersById.get(otherId);
      if (!user) {
        return;
      }
      if (relationship.status === RELATIONSHIP_STATUSES.ACCEPTED) {
        response.friends.push({
          acceptedAt: relationship.stateChangedAt,
          user,
        });
      } else {
        const request = {
          requestedAt: relationship.stateChangedAt,
          user,
        };
        response[relationship.requestedBy === actorId ? 'outgoing' : 'incoming'].push(request);
      }
    });
    ownBlocks.forEach((entry) => {
      const user = usersById.get(entry.blockedId);
      if (user) {
        response.blocked.push({ blockedAt: entry.createdAt, user });
      }
    });

    ['blocked', 'friends', 'incoming', 'outgoing'].forEach((key) => {
      response[key].sort((first, second) => first.user.id - second.user.id);
    });
    return response;
  };

  const requireAcceptedFriend = async (actorUser, targetValue) => {
    const {
      pair, targetUser,
    } = await loadUsers(actorUser, targetValue);
    const unavailable = () => {
      throw new SocialError(
        409,
        'relationship_unavailable',
        'The requested relationship action is not available',
      );
    };

    if (await pairIsBlocked(pair.pairKey)) {
      return unavailable();
    }

    const relationship = await lean(relationshipModel.findOne({ pairKey: pair.pairKey }));
    if (!relationship || relationship.status !== RELATIONSHIP_STATUSES.ACCEPTED) {
      return unavailable();
    }
    return targetUser;
  };

  return {
    acceptRequest: (actor, targetId) => act(actor, targetId, ACTIONS.ACCEPT),
    block,
    cancelRequest: (actor, targetId) => act(actor, targetId, ACTIONS.CANCEL),
    declineRequest: (actor, targetId) => act(actor, targetId, ACTIONS.DECLINE),
    list,
    requireAcceptedFriend,
    sendRequest: (actor, targetId) => act(actor, targetId, ACTIONS.SEND),
    unblock,
    unfriend: (actor, targetId) => act(actor, targetId, ACTIONS.UNFRIEND),
  };
};

module.exports = {
  createRelationshipService,
  normalizeUserId,
  normalizedPair,
  ...createRelationshipService(),
};
