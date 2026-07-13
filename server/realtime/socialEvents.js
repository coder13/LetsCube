const Redis = require('ioredis');

const Protocol = require('../../client/src/lib/protocol.json');
const config = require('../runtimeConfig');
const logger = require('../logger');
const { encodeUser } = require('../socket/utils');

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

const createSocialEventPublisher = ({
  client,
  eventLogger = logger,
  now = () => new Date(),
} = {}) => async ({ userIds }) => {
  const recipients = normalizeRecipients(userIds || []);
  if (recipients.length === 0) {
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
      type: Protocol.FRIEND_STATE_INVALIDATED,
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
    if (event.schemaVersion !== 1 || event.type !== Protocol.FRIEND_STATE_INVALIDATED) {
      return null;
    }
    const userIds = normalizeRecipients(event.userIds || []);
    if (userIds.length === 0) {
      return null;
    }
    return {
      payload: {
        occurredAt: event.occurredAt,
        schemaVersion: event.schemaVersion,
      },
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
        Protocol.FRIEND_STATE_INVALIDATED,
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
  registerSocialEventSubscriber,
};
