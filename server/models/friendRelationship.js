const mongoose = require('mongoose');

const RELATIONSHIP_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  CANCELED: 'canceled',
  DECLINED: 'declined',
  PENDING: 'pending',
  REMOVED: 'removed',
});

const FriendRelationship = new mongoose.Schema({
  pairKey: {
    type: String,
    required: true,
  },
  lowUserId: {
    type: Number,
    required: true,
  },
  highUserId: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(RELATIONSHIP_STATUSES),
    required: true,
  },
  requestedBy: Number,
  cooldownUntil: Date,
  stateChangedAt: {
    type: Date,
    required: true,
  },
  revision: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
});

FriendRelationship.index({ pairKey: 1 }, { unique: true });
FriendRelationship.index({ lowUserId: 1, status: 1 });
FriendRelationship.index({ highUserId: 1, status: 1 });
FriendRelationship.index({ requestedBy: 1, status: 1 });

FriendRelationship.pre('validate', function validatePair(next) {
  if (this.lowUserId >= this.highUserId) {
    next(new Error('Friend relationship users must be a normalized distinct pair'));
    return;
  }
  if (this.pairKey !== `${this.lowUserId}:${this.highUserId}`) {
    next(new Error('Friend relationship pair key does not match its users'));
    return;
  }
  const requesterIsMember = this.requestedBy === this.lowUserId
    || this.requestedBy === this.highUserId;
  const stateHasNoRequester = this.status === RELATIONSHIP_STATUSES.ACCEPTED
    || this.status === RELATIONSHIP_STATUSES.REMOVED;
  if (stateHasNoRequester
    ? this.requestedBy !== null && this.requestedBy !== undefined
    : !requesterIsMember) {
    next(new Error('Friend relationship requester does not match its state'));
    return;
  }
  next();
});

module.exports = {
  FriendRelationship,
  RELATIONSHIP_STATUSES,
};
