const Redis = require('ioredis');

const Protocol = require('../../client/src/lib/protocol.json');
const config = require('../runtimeConfig');
const logger = require('../logger');
const { encodeUser } = require('../socket/utils');
const { isKnownNotification } = require('../social/notificationTypes');

const SOCIAL_EVENT_CHANNEL = 'letscube:social-events:v1';

let publisher;

const createRedisPublisher = () => {
  const client = config.redis.url
    ? new Redis(config.redis.url, { lazyConnect: true, maxRetriesPerRequest: 1 })
    : new Redis({
      db: config.redis.db,
      host: config.redis.host,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      password: config.redis.password,
      port: config.redis.port,
    });
  client.on('error', (err) => logger.error(err));
  return client;
};

const normalizeRecipients = (userIds) => [...new Set(userIds.map(Number).filter(
  (userId) => Number.isSafeInteger(userId) && userId > 0,
))];

const notificationPayload = (notification, updated = false) => {
  if (!notification) {
    return null;
  }
  if (updated) {
    if (!notification.readAt) {
      return null;
    }
    return {
      ...(typeof notification.id === 'string' ? { id: notification.id } : {}),
      readAt: notification.readAt,
    };
  }
  if (typeof notification.id !== 'string') {
    return null;
  }
  if (!isKnownNotification({
    sourceType: notification.source && notification.source.type,
    type: notification.type,
  }) || !notification.actorId || !notification.createdAt || !notification.expiresAt
    || !notification.source.id) {
    return null;
  }
  return notification;
};

const createSocialEventPublisher = ({
  client,
  eventLogger = logger,
  now = () => new Date(),
} = {}) => async ({ notification, type = Protocol.FRIEND_STATE_INVALIDATED, userIds }) => {
  const recipients = normalizeRecipients(userIds || []);
  const isNotificationEvent = type === Protocol.NOTIFICATION_CREATED
    || type === Protocol.NOTIFICATION_UPDATED;
  const sanitizedNotification = isNotificationEvent
    ? notificationPayload(notification, type === Protocol.NOTIFICATION_UPDATED) : null;
  if (recipients.length === 0 || (isNotificationEvent && !sanitizedNotification)
    || (!isNotificationEvent && type !== Protocol.FRIEND_STATE_INVALIDATED)) {
    return false;
  }

  try {
    const redis = client || publisher || createRedisPublisher();
    if (!client && !publisher) {
      publisher = redis;
    }
    await redis.publish(SOCIAL_EVENT_CHANNEL, JSON.stringify({
      occurredAt: now().toISOString(),
      schemaVersion: 1,
      ...(sanitizedNotification ? { notification: sanitizedNotification } : {}),
      type,
      userIds: recipients,
    }));
    return true;
  } catch (err) {
    eventLogger.error(err);
    return false;
  }
};

const parseSocialEvent = (message) => {
  try {
    const event = JSON.parse(message);
    const isNotificationEvent = event.type === Protocol.NOTIFICATION_CREATED
      || event.type === Protocol.NOTIFICATION_UPDATED;
    if (event.schemaVersion !== 1 || (event.type !== Protocol.FRIEND_STATE_INVALIDATED
      && !isNotificationEvent)) {
      return null;
    }
    const userIds = normalizeRecipients(event.userIds || []);
    if (userIds.length === 0) {
      return null;
    }
    const notification = isNotificationEvent
      ? notificationPayload(event.notification, event.type === Protocol.NOTIFICATION_UPDATED)
      : null;
    if (isNotificationEvent && !notification) {
      return null;
    }
    return {
      payload: isNotificationEvent ? { notification, schemaVersion: event.schemaVersion } : {
        occurredAt: event.occurredAt,
        schemaVersion: event.schemaVersion,
      },
      type: event.type,
      userIds,
    };
  } catch (err) {
    return null;
  }
};

const registerSocialEventSubscriber = (io, client, eventLogger = logger) => {
  const namespace = io.of('/');
  client.on('message', (channel, message) => {
    if (channel !== SOCIAL_EVENT_CHANNEL) {
      return;
    }
    const event = parseSocialEvent(message);
    if (!event) {
      eventLogger.error(new Error('Ignored invalid social event'));
      return;
    }
    event.userIds.forEach((userId) => {
      namespace.to(encodeUser(userId)).emit(
        event.type,
        event.payload,
      );
    });
  });
  client.subscribe(SOCIAL_EVENT_CHANNEL).catch((err) => eventLogger.error(err));
};

module.exports = {
  SOCIAL_EVENT_CHANNEL,
  createSocialEventPublisher,
  parseSocialEvent,
  publishSocialInvalidation: createSocialEventPublisher(),
  publishNotificationCreated: ({ notification, recipientId }) => createSocialEventPublisher()({
    notification,
    type: Protocol.NOTIFICATION_CREATED,
    userIds: [recipientId],
  }),
  publishNotificationUpdated: ({ notification, recipientId }) => createSocialEventPublisher()({
    notification,
    type: Protocol.NOTIFICATION_UPDATED,
    userIds: [recipientId],
  }),
  registerSocialEventSubscriber,
};
