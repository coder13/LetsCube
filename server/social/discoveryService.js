const { FriendRelationship, User, UserBlock } = require('../models');
const { normalizeUsername } = require('../username');
const publicUserProjection = require('./publicUser');
const { SocialError } = require('./relationshipState');
const { searchRateLimiter } = require('./discoveryRateLimiter');

const MAX_RESULTS = 20;
const WCA_ID = /^\d{4}[a-z]{4}\d{2}$/i;

const lean = async (query) => (query && typeof query.lean === 'function' ? query.lean() : query);
const toId = (value) => (typeof value === 'string' && /^\d+$/.test(value)
  ? Number(value) : value);
const validId = (value) => Number.isSafeInteger(value) && value > 0;
const pairKey = (first, second) => `${Math.min(first, second)}:${Math.max(first, second)}`;

const decodeCursor = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return validId(parsed.id) ? parsed : null;
  } catch {
    return null;
  }
};

const encodeCursor = (user) => Buffer.from(JSON.stringify({
  id: user.id,
})).toString('base64url');

const relationshipDetails = (actorId, targetId, relationship) => {
  if (!relationship || relationship.status === 'removed') {
    return { actions: ['request', 'block'], relationship: 'none' };
  }
  if (relationship.status === 'accepted') {
    return { actions: ['unfriend', 'block'], relationship: 'friends' };
  }
  if (relationship.status === 'pending') {
    return relationship.requestedBy === actorId
      ? { actions: ['cancel', 'block'], relationship: 'outgoing' }
      : { actions: ['accept', 'decline', 'block'], relationship: 'incoming' };
  }
  return { actions: ['request', 'block'], relationship: 'none' };
};

const createDiscoveryService = ({
  blockModel = UserBlock,
  relationshipModel = FriendRelationship,
  searchLimiter = searchRateLimiter,
  userModel = User,
} = {}) => {
  const actorId = (actor) => {
    const id = toId(actor && actor.id);
    if (!validId(id)) throw new SocialError(401, 'authentication_required', 'Authentication is required');
    return id;
  };

  const blockedIds = async (id) => {
    const blocks = await lean(blockModel.find({
      active: true,
      $or: [{ blockerId: id }, { blockedId: id }],
    }));
    return new Set(blocks.map((block) => (
      block.blockerId === id ? block.blockedId : block.blockerId
    )));
  };

  const publicProfile = async (actor, targetValue) => {
    const viewerId = actorId(actor);
    if (typeof targetValue !== 'string' || targetValue.includes('@')) return null;
    const query = targetValue.normalize('NFKC').trim();
    if (!query) return null;
    let targetQuery;
    if (WCA_ID.test(query)) {
      targetQuery = { showWCAID: true, wcaId: query.toUpperCase() };
    } else {
      try {
        targetQuery = {
          usernameNormalized: normalizeUsername(query, { allowEmpty: false }).usernameNormalized,
        };
      } catch {
        return null;
      }
    }
    await searchLimiter.consume({ actorId: viewerId });
    const target = await lean(userModel.findOne(targetQuery));
    const targetId = target && target.id;
    if (!target || (await blockedIds(viewerId)).has(targetId)) return null;
    const relationship = viewerId === targetId ? null : await lean(
      relationshipModel.findOne({ pairKey: pairKey(viewerId, targetId) }),
    );
    const details = viewerId === targetId
      ? { actions: [], relationship: 'self' }
      : relationshipDetails(viewerId, targetId, relationship);
    return { ...publicUserProjection(target), ...details };
  };

  const search = async (actor, queryValue, limitValue, cursorValue) => {
    const viewerId = actorId(actor);
    if (typeof queryValue !== 'string' || queryValue.includes('@')) {
      return { nextCursor: null, results: [] };
    }
    const query = queryValue.normalize('NFKC').trim();
    if (!query) return { nextCursor: null, results: [] };
    let username;
    try {
      username = normalizeUsername(query, { allowEmpty: false }).usernameNormalized;
    } catch {
      if (!WCA_ID.test(query)) return { nextCursor: null, results: [] };
    }
    await searchLimiter.consume({ actorId: viewerId });
    const requestedLimit = Number.parseInt(limitValue, 10) || MAX_RESULTS;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_RESULTS);
    const conditions = [{ id: { $ne: viewerId } }];
    if (username && !WCA_ID.test(query)) {
      conditions.push({ usernameNormalized: { $gte: username, $lt: `${username}\uffff` } });
    }
    if (WCA_ID.test(query)) {
      const wcaId = query.toUpperCase();
      conditions.push({
        $or: [
          ...(username ? [{ usernameNormalized: { $gte: username, $lt: `${username}\uffff` } }] : []),
          { showWCAID: true, wcaId },
        ],
      });
    }
    const cursor = decodeCursor(cursorValue);
    if (cursor) {
      conditions.push({ id: { $gt: cursor.id } });
    }
    const blocked = await blockedIds(viewerId);
    const users = await lean(userModel.find({ $and: conditions })
      .sort({ id: 1 }).limit(limit + blocked.size + 1));
    const visible = users.filter((user) => !blocked.has(user.id));
    const page = visible.slice(0, limit).map((user) => publicUserProjection(user));
    return {
      nextCursor: visible.length > limit && page.length
        ? encodeCursor(visible[limit - 1])
        : null,
      results: page,
    };
  };

  return { publicProfile, search };
};

module.exports = {
  MAX_RESULTS, createDiscoveryService, decodeCursor, encodeCursor, relationshipDetails,
};
