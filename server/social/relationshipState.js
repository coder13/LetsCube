const { RELATIONSHIP_STATUSES } = require('../models/friendRelationship');

const ACTIONS = Object.freeze({
  ACCEPT: 'accept',
  CANCEL: 'cancel',
  DECLINE: 'decline',
  SEND: 'send',
  UNFRIEND: 'unfriend',
});

const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CANCEL_COOLDOWN_MS = 60 * 1000;

class SocialError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, details);
  }
}

const failTransition = () => {
  throw new SocialError(
    409,
    'invalid_relationship_transition',
    'The requested relationship transition is not available',
  );
};

const terminalRequest = (current, status, now, cooldownMs) => ({
  ...current,
  status,
  cooldownUntil: new Date(now.getTime() + cooldownMs),
  stateChangedAt: now,
});

const transitionRelationship = ({
  action, actorId, current, now, pair, targetId,
}) => {
  if (action === ACTIONS.SEND) {
    if (!current) {
      return {
        kind: 'upsert',
        outcome: 'request_created',
        relationship: {
          ...pair,
          status: RELATIONSHIP_STATUSES.PENDING,
          requestedBy: actorId,
          cooldownUntil: null,
          stateChangedAt: now,
        },
      };
    }

    if (current.status === RELATIONSHIP_STATUSES.ACCEPTED) {
      return { kind: 'noop', outcome: 'already_friends', relationship: current };
    }

    if (current.status === RELATIONSHIP_STATUSES.PENDING) {
      if (current.requestedBy === actorId) {
        return { kind: 'noop', outcome: 'request_replayed', relationship: current };
      }
      return {
        kind: 'upsert',
        outcome: 'crossed_request_accepted',
        relationship: {
          ...current,
          status: RELATIONSHIP_STATUSES.ACCEPTED,
          requestedBy: null,
          cooldownUntil: null,
          stateChangedAt: now,
        },
      };
    }

    if (current.cooldownUntil && new Date(current.cooldownUntil) > now) {
      const retryAfterSeconds = Math.ceil(
        (new Date(current.cooldownUntil).getTime() - now.getTime()) / 1000,
      );
      throw new SocialError(
        409,
        'request_cooldown',
        'A friend request cannot be sent to this user yet',
        { retryAfterSeconds },
      );
    }

    return {
      kind: 'upsert',
      outcome: 'request_created',
      relationship: {
        ...current,
        status: RELATIONSHIP_STATUSES.PENDING,
        requestedBy: actorId,
        cooldownUntil: null,
        stateChangedAt: now,
      },
    };
  }

  if (action === ACTIONS.CANCEL) {
    if (current && current.status === RELATIONSHIP_STATUSES.CANCELED
      && current.requestedBy === actorId) {
      return { kind: 'noop', outcome: 'cancel_replayed', relationship: current };
    }
    if (!current || current.status !== RELATIONSHIP_STATUSES.PENDING
      || current.requestedBy !== actorId) {
      return failTransition();
    }
    return {
      kind: 'upsert',
      outcome: 'request_canceled',
      relationship: terminalRequest(
        current,
        RELATIONSHIP_STATUSES.CANCELED,
        now,
        CANCEL_COOLDOWN_MS,
      ),
    };
  }

  if (action === ACTIONS.ACCEPT) {
    if (current && current.status === RELATIONSHIP_STATUSES.ACCEPTED) {
      return { kind: 'noop', outcome: 'accept_replayed', relationship: current };
    }
    if (!current || current.status !== RELATIONSHIP_STATUSES.PENDING
      || current.requestedBy !== targetId) {
      return failTransition();
    }
    return {
      kind: 'upsert',
      outcome: 'request_accepted',
      relationship: {
        ...current,
        status: RELATIONSHIP_STATUSES.ACCEPTED,
        requestedBy: null,
        cooldownUntil: null,
        stateChangedAt: now,
      },
    };
  }

  if (action === ACTIONS.DECLINE) {
    if (current && current.status === RELATIONSHIP_STATUSES.DECLINED
      && current.requestedBy === targetId) {
      return { kind: 'noop', outcome: 'decline_replayed', relationship: current };
    }
    if (!current || current.status !== RELATIONSHIP_STATUSES.PENDING
      || current.requestedBy !== targetId) {
      return failTransition();
    }
    return {
      kind: 'upsert',
      outcome: 'request_declined',
      relationship: terminalRequest(
        current,
        RELATIONSHIP_STATUSES.DECLINED,
        now,
        DECLINE_COOLDOWN_MS,
      ),
    };
  }

  if (action === ACTIONS.UNFRIEND) {
    if (!current || current.status === RELATIONSHIP_STATUSES.REMOVED) {
      return { kind: 'noop', outcome: 'unfriend_replayed', relationship: null };
    }
    if (current.status !== RELATIONSHIP_STATUSES.ACCEPTED) {
      return failTransition();
    }
    return {
      kind: 'upsert',
      outcome: 'unfriended',
      relationship: {
        ...current,
        cooldownUntil: null,
        requestedBy: null,
        stateChangedAt: now,
        status: RELATIONSHIP_STATUSES.REMOVED,
      },
    };
  }

  throw new SocialError(400, 'invalid_action', 'Unknown relationship action');
};

module.exports = {
  ACTIONS,
  CANCEL_COOLDOWN_MS,
  DECLINE_COOLDOWN_MS,
  SocialError,
  transitionRelationship,
};
