const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const config = require('../runtimeConfig');
const session = require('../middlewares/session');
const { connect } = require('../database');
const { createHealthHandler, createHealthReporter } = require('../health');
const { initializePostgres, pool } = require('../postgres');
const logger = require('../logger');
const loggerMiddleware = require('./middlewares/logger');
const authenticateMiddleware = require('./middlewares/authenticate');
const { registerSocialEventSubscriber } = require('../realtime/socialEvents');
const { isFeatureEnabled } = require('../features');
const wrapExpressMiddleware = require('./middlewares/wrapExpressMiddleware');
const initRooms = require('./namespaces/rooms');
const initDefault = require('./namespaces/default');

const logSocketError = (source) => (err) => {
  if (err) {
    logger.error(`[SOCKET.IO] ${source} error: ${err.stack || err}`);
  }
};

const watchNamespaceErrors = (io, namespace) => {
  const ns = io.of(namespace);

  ns.on('error', logSocketError(`${namespace} namespace`));

  if (ns.adapter && ns.adapter.on) {
    ns.adapter.on('error', logSocketError(`${namespace} adapter`));
  }
};

const init = async () => {
  const server = http.createServer();
  const io = new Server(server, {
    cors: {
      origin: true,
      // config.cors.origin.map((o) => new RegExp(o)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    cookie: {
      name: 'io',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'prod',
    },
  });

  server.on('error', logSocketError('http server'));
  io.on('error', logSocketError('server'));

  const mongoose = await connect();
  await initializePostgres();

  const pubClient = new Redis(config.redis.url || {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });
  const subClient = pubClient.duplicate();
  const socialSubClient = config.socialFeatures.enabled && isFeatureEnabled('friends')
    ? pubClient.duplicate() : null;

  pubClient.on('error', logSocketError('redis pub client'));
  subClient.on('error', logSocketError('redis sub client'));
  if (socialSubClient) {
    socialSubClient.on('error', logSocketError('redis social sub client'));
  }

  io.adapter(createAdapter(pubClient, subClient));
  if (socialSubClient) {
    registerSocialEventSubscriber(io, socialSubClient);
  }

  const reportHealth = createHealthReporter({
    service: 'socket',
    checks: {
      mongodb: () => mongoose.connection.readyState === 1,
      postgres: {
        required: false,
        check: async () => {
          if (config.postgres.enabled) {
            await pool.query('SELECT 1');
          }
          return true;
        },
      },
      redis: async () => pubClient.status === 'ready'
        && subClient.status === 'ready'
        && (!socialSubClient || socialSubClient.status === 'ready')
        && (await pubClient.ping()) === 'PONG',
    },
  });
  const handleHealth = createHealthHandler(reportHealth);
  server.on('request', (req, res) => {
    if (req.method === 'GET' && req.url.split('?')[0] === '/health/socket') {
      handleHealth(req, res);
    }
  });

  const middlewares = [
    wrapExpressMiddleware(session),
    authenticateMiddleware,
    loggerMiddleware,
  ];

  initRooms(io, middlewares);
  initDefault(io, middlewares, reportHealth);
  watchNamespaceErrors(io, '/');
  watchNamespaceErrors(io, '/rooms');

  return server.listen(process.env.SOCKETIO_PORT || config.socketio.port);
};

init();
