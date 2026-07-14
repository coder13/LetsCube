const Redis = require('ioredis');
const config = require('../runtimeConfig');
const logger = require('../logger');
const { SocialError } = require('./relationshipState');

const SEARCH_LIMIT = 30;
const SEARCH_WINDOW_SECONDS = 60;
const KEY_PREFIX = 'letscube:social:discovery-search:v1';

const createClient = () => {
  const client = new Redis(config.redis.url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on('error', (err) => logger.error(err));
  return client;
};

let sharedClient;

const createDiscoveryRateLimiter = ({ client, rateLimitLogger = logger } = {}) => ({
  consume: async ({ actorId }) => {
    try {
      const redis = client || sharedClient || createClient();
      if (!client) sharedClient = redis;
      const key = `${KEY_PREFIX}:${actorId}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, SEARCH_WINDOW_SECONDS);
      if (count > SEARCH_LIMIT) {
        const ttl = await redis.ttl(key);
        throw new SocialError(429, 'search_rate_limited', 'Search is temporarily limited', {
          retryAfterSeconds: Number.isSafeInteger(ttl) && ttl > 0 ? ttl : 1,
        });
      }
    } catch (err) {
      if (err instanceof SocialError) throw err;
      rateLimitLogger.error(err);
      throw new SocialError(503, 'search_rate_limit_unavailable', 'Search is temporarily unavailable');
    }
  },
});

module.exports = {
  SEARCH_LIMIT,
  SEARCH_WINDOW_SECONDS,
  createDiscoveryRateLimiter,
  searchRateLimiter: createDiscoveryRateLimiter(),
};
