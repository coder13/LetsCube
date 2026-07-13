const Redis = require('ioredis');

const config = require('../runtimeConfig');
const logger = require('../logger');
const { SocialError } = require('./relationshipState');

const PAIR_REQUEST_LIMIT = 3;
const PAIR_REQUEST_WINDOW_SECONDS = 24 * 60 * 60;
const USER_REQUEST_LIMIT = 30;
const USER_REQUEST_WINDOW_SECONDS = 10 * 60;
const KEY_PREFIX = 'letscube:social:request-creation:v1';

const CONSUME_REQUEST_CREATION_LIMIT = `
local userCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local pairCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local userLimit = tonumber(ARGV[1])
local pairLimit = tonumber(ARGV[2])

if userCount >= userLimit then
  return { 0, 'user', redis.call('TTL', KEYS[1]) }
end
if pairCount >= pairLimit then
  return { 0, 'pair', redis.call('TTL', KEYS[2]) }
end

local userNext = redis.call('INCR', KEYS[1])
if userNext == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
end
local pairNext = redis.call('INCR', KEYS[2])
if pairNext == 1 or redis.call('TTL', KEYS[2]) < 0 then
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
end

return { 1, '', 0 }
`;

let redisClient;

const createRedisClient = () => {
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

const retryAfterSeconds = (value) => {
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 1;
};

const createRequestRateLimiter = ({
  client,
  rateLimitLogger = logger,
} = {}) => ({
  consume: async ({ actorId, pairKey }) => {
    try {
      const redis = client || redisClient || createRedisClient();
      if (!client && !redisClient) {
        redisClient = redis;
      }
      const result = await redis.eval(
        CONSUME_REQUEST_CREATION_LIMIT,
        2,
        `${KEY_PREFIX}:user:${actorId}`,
        `${KEY_PREFIX}:pair:${pairKey}`,
        USER_REQUEST_LIMIT,
        PAIR_REQUEST_LIMIT,
        USER_REQUEST_WINDOW_SECONDS,
        PAIR_REQUEST_WINDOW_SECONDS,
      );
      if (!Array.isArray(result) || Number(result[0]) !== 1) {
        throw new SocialError(
          429,
          'request_rate_limited',
          'Friend requests are temporarily limited',
          { retryAfterSeconds: retryAfterSeconds(result && result[2]) },
        );
      }
    } catch (err) {
      if (err instanceof SocialError) {
        throw err;
      }
      rateLimitLogger.error(err);
      throw new SocialError(
        503,
        'request_rate_limit_unavailable',
        'Friend requests are temporarily unavailable',
      );
    }
  },
});

module.exports = {
  CONSUME_REQUEST_CREATION_LIMIT,
  PAIR_REQUEST_LIMIT,
  PAIR_REQUEST_WINDOW_SECONDS,
  USER_REQUEST_LIMIT,
  USER_REQUEST_WINDOW_SECONDS,
  createRequestRateLimiter,
  requestRateLimiter: createRequestRateLimiter(),
};
