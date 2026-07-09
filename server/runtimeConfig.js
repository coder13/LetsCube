const baseConfig = require('getconfig');

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseOrigins = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const redisUrl = process.env.REDIS_URL || (baseConfig.redis && baseConfig.redis.url) || 'redis://localhost:6379';
let redis = {
  ...(baseConfig.redis || {}),
  url: redisUrl,
  host: process.env.REDIS_HOST || (baseConfig.redis && baseConfig.redis.host) || 'localhost',
  port: parsePort(process.env.REDIS_PORT, (baseConfig.redis && baseConfig.redis.port) || 6379),
};

try {
  const parsedRedisUrl = new URL(redisUrl);
  redis = {
    ...redis,
    host: parsedRedisUrl.hostname || redis.host,
    port: parsePort(parsedRedisUrl.port, redis.port),
    password: parsedRedisUrl.password ? decodeURIComponent(parsedRedisUrl.password) : redis.password,
    db: parsedRedisUrl.pathname && parsedRedisUrl.pathname !== '/'
      ? parsePort(parsedRedisUrl.pathname.slice(1), redis.db)
      : redis.db,
  };
} catch (err) {
  // Keep host/port fallbacks for non-URL Redis config values.
}

module.exports = {
  ...baseConfig,
  server: {
    ...baseConfig.server,
    port: parsePort(process.env.PORT || process.env.SERVER_PORT, baseConfig.server.port),
  },
  socketio: {
    ...baseConfig.socketio,
    port: parsePort(process.env.SOCKETIO_PORT, baseConfig.socketio.port),
  },
  mongodb: process.env.MONGO_URL || process.env.MONGODB_URI || baseConfig.mongodb,
  redis,
  wcaSource: process.env.WCA_SOURCE || process.env.REACT_APP_WCA_ORIGIN || baseConfig.wcaSource,
  auth: {
    ...baseConfig.auth,
    secret: process.env.AUTH_SECRET || process.env.SESSION_SECRET || baseConfig.auth.secret,
    callbackURL: process.env.AUTH_CALLBACK_URL || baseConfig.auth.callbackURL || baseConfig.auth.callbackUrl,
    callbackUrl: process.env.AUTH_CALLBACK_URL || baseConfig.auth.callbackUrl || baseConfig.auth.callbackURL,
    clientID: process.env.WCA_CLIENT_ID || process.env.REACT_APP_WCA_CLIENT_ID || baseConfig.auth.clientID,
    clientSecret: process.env.WCA_CLIENT_SECRET || baseConfig.auth.clientSecret,
  },
  cors: {
    ...baseConfig.cors,
    origin: parseOrigins(process.env.CORS_ORIGINS, baseConfig.cors.origin),
  },
};
