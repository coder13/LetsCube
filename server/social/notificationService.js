const mongoose = require('mongoose');

const logger = require('../logger');
const { SocialNotification, User } = require('../models');
const { mirrorNotification } = require('../postgres/dualWrite');
const {
  publishNotificationCreated,
  publishNotificationUpdated,
} = require('../realtime/socialEvents');
const publicUserProjection = require('./publicUser');
const {
  isKnownNotification,
  NOTIFICATION_SOURCE_TYPES,
  NOTIFICATION_TYPES,
} = require('./notificationTypes');

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

class NotificationError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const toPlain = (document) => (
  document && typeof document.toObject === 'function' ? document.toObject() : document
);

const lean = async (query) => (query && typeof query.lean === 'function' ? query.lean() : query);

const normalizeUserId = (value) => {
  const userId = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new NotificationError(400, 'invalid_notification', 'Invalid notification recipient');
  }
  return userId;
};

const cursorFor = (notification) => Buffer.from(JSON.stringify({
  createdAt: new Date(notification.createdAt).toISOString(),
  id: notification._id.toString(),
})).toString('base64url');

const parseCursor = (cursor) => {
  if (!cursor) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      throw new Error('invalid cursor');
    }
    return { createdAt, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch (err) {
    throw new NotificationError(400, 'invalid_cursor', 'Invalid notification cursor');
  }
};

const pageSize = (value) => {
  if (value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new NotificationError(400, 'invalid_limit', 'Notification limit must be between 1 and 50');
  }
  return parsed;
};

const socketNotification = (notification) => ({
  actorId: notification.actorId,
  createdAt: notification.createdAt,
  expiresAt: notification.expiresAt,
  id: notification._id.toString(),
  readAt: notification.readAt || null,
  source: {
    id: notification.sourceId,
    type: notification.sourceType,
  },
  type: notification.type,
});

const notificationDocument = ({
  actorId, dedupeKey, expiresAt, recipientId, sourceId, sourceType, type,
}) => ({
  actorId: normalizeUserId(actorId),
  dedupeKey,
  expiresAt,
  recipientId: normalizeUserId(recipientId),
  sourceId: String(sourceId),
  sourceType,
  type,
});

const createNotificationService = ({
  eventPublisher = {
    publishCreated: publishNotificationCreated,
    publishUpdated: publishNotificationUpdated,
  },
  mirror = mirrorNotification,
  notificationModel = SocialNotification,
  notificationLogger = logger,
  now = () => new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS,
  userModel = User,
} = {}) => {
  const runInBackground = (operation) => Promise.resolve(operation).catch(
    (err) => notificationLogger.error(err),
  );

  const create = async (input) => {
    const document = notificationDocument(input);
    if (!isKnownNotification(document) || !document.sourceId || !document.dedupeKey
      || document.actorId === document.recipientId) {
      throw new NotificationError(400, 'invalid_notification', 'Invalid notification resource');
    }

    let notification;
    try {
      notification = toPlain(await notificationModel.create(document));
    } catch (err) {
      if (err && err.code === 11000) {
        return { created: false, notification: null };
      }
      throw err;
    }

    const payload = socketNotification(notification);
    runInBackground(mirror(notification));
    runInBackground(eventPublisher.publishCreated({
      notification: payload,
      recipientId: notification.recipientId,
    }));
    return { created: true, notification };
  };

  const createFriendRequest = ({ actor, recipient, relationship }) => create({
    actorId: actor.id,
    dedupeKey: `friend-request:${relationship._id}:${relationship.revision}`,
    expiresAt: new Date(now().getTime() + retentionDays * 24 * 60 * 60 * 1000),
    recipientId: recipient.id,
    sourceId: relationship._id.toString(),
    sourceType: NOTIFICATION_SOURCE_TYPES.FRIEND_RELATIONSHIP,
    type: NOTIFICATION_TYPES.FRIEND_REQUEST,
  });

  const createFriendRequestAccepted = ({ actor, recipient, relationship }) => create({
    actorId: actor.id,
    dedupeKey: `friend-request-accepted:${relationship._id}:${relationship.revision}`,
    expiresAt: new Date(now().getTime() + retentionDays * 24 * 60 * 60 * 1000),
    recipientId: recipient.id,
    sourceId: relationship._id.toString(),
    sourceType: NOTIFICATION_SOURCE_TYPES.FRIEND_RELATIONSHIP,
    type: NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED,
  });

  const list = async (actor, { cursor, limit } = {}) => {
    const recipientId = normalizeUserId(actor && actor.id);
    const parsedCursor = parseCursor(cursor);
    const effectiveLimit = pageSize(limit);
    const filter = {
      expiresAt: { $gt: now() },
      recipientId,
    };
    if (parsedCursor) {
      filter.$or = [
        { createdAt: { $lt: parsedCursor.createdAt } },
        { createdAt: parsedCursor.createdAt, _id: { $lt: parsedCursor.id } },
      ];
    }

    const [results, unreadCount] = await Promise.all([
      lean(notificationModel.find(filter).sort({ createdAt: -1, _id: -1 })
        .limit(effectiveLimit + 1)),
      notificationModel.countDocuments({
        expiresAt: { $gt: now() },
        readAt: null,
        recipientId,
      }),
    ]);
    const notifications = results.slice(0, effectiveLimit);
    const actorIds = [...new Set(notifications.map((entry) => entry.actorId))];
    const actors = actorIds.length
      ? await lean(userModel.find({ id: { $in: actorIds } }))
      : [];
    const actorsById = new Map(actors.map((user) => [user.id, publicUserProjection(user)]));

    return {
      nextCursor: results.length > effectiveLimit
        ? cursorFor(notifications[notifications.length - 1]) : null,
      notifications: notifications.map((notification) => ({
        ...socketNotification(notification),
        actor: actorsById.get(notification.actorId) || null,
      })),
      unreadCount,
    };
  };

  const markRead = async (actor, notificationId) => {
    const recipientId = normalizeUserId(actor && actor.id);
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new NotificationError(404, 'notification_not_found', 'Notification not found');
    }
    const notification = toPlain(await notificationModel.findOneAndUpdate({
      _id: notificationId,
      recipientId,
    }, {
      $set: { readAt: now() },
    }, {
      new: true,
      useFindAndModify: false,
    }));
    if (!notification) {
      throw new NotificationError(404, 'notification_not_found', 'Notification not found');
    }
    runInBackground(mirror(notification));
    runInBackground(eventPublisher.publishUpdated({
      notification: {
        id: notification._id.toString(),
        readAt: notification.readAt,
      },
      recipientId,
    }));
    return { notification: socketNotification(notification) };
  };

  const markAllRead = async (actor) => {
    const recipientId = normalizeUserId(actor && actor.id);
    const readAt = now();
    const result = await notificationModel.updateMany({
      expiresAt: { $gt: readAt },
      readAt: null,
      recipientId,
    }, {
      $set: { readAt },
    });
    runInBackground(eventPublisher.publishUpdated({
      notification: { readAt },
      recipientId,
    }));
    return {
      updated: result.modifiedCount === undefined ? result.nModified : result.modifiedCount,
    };
  };

  return {
    create,
    createFriendRequest,
    createFriendRequestAccepted,
    list,
    markAllRead,
    markRead,
  };
};

module.exports = {
  createNotificationService,
  cursorFor,
  parseCursor,
  socketNotification,
  ...createNotificationService(),
};
