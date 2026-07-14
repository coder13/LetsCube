const mongoose = require('mongoose');

const {
  NOTIFICATION_SOURCE_TYPES,
  NOTIFICATION_TYPES,
  SOURCE_TYPE_BY_NOTIFICATION_TYPE,
} = require('../social/notificationTypes');

const SocialNotification = new mongoose.Schema({
  recipientId: {
    type: Number,
    required: true,
  },
  actorId: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true,
  },
  sourceType: {
    type: String,
    enum: Object.values(NOTIFICATION_SOURCE_TYPES),
    required: true,
  },
  sourceId: {
    type: String,
    required: true,
  },
  dedupeKey: {
    type: String,
    required: true,
  },
  readAt: Date,
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

SocialNotification.index({ dedupeKey: 1 }, { unique: true });
SocialNotification.index({
  recipientId: 1, readAt: 1, createdAt: -1, _id: -1,
});
SocialNotification.index({ recipientId: 1, createdAt: -1, _id: -1 });
SocialNotification.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

SocialNotification.pre('validate', function validateNotification(next) {
  if (!Number.isSafeInteger(this.recipientId) || this.recipientId <= 0
    || !Number.isSafeInteger(this.actorId) || this.actorId <= 0
    || this.recipientId === this.actorId) {
    next(new Error('Notification actor and recipient must be distinct valid users'));
    return;
  }
  if (SOURCE_TYPE_BY_NOTIFICATION_TYPE[this.type] !== this.sourceType) {
    next(new Error('Notification type must use its registered source type'));
    return;
  }
  next();
});

module.exports = SocialNotification;
