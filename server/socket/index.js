const http = require('http');
const config = require('../runtimeConfig');
const socketIO = require('socket.io');
const redis = require('socket.io-redis');
const expressSocketSession = require('express-socket.io-session');
const session = require('../middlewares/session');
const { connect } = require('../database');
const logger = require('../logger');
const loggerMiddleware = require('./middlewares/logger');
const authenticateMiddleware = require('./middlewares/authenticate');
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
  const io = socketIO(server, {
    cors: {
      origin: true,
      // config.cors.origin.map((o) => new RegExp(o)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    cookie: {
      name: config.auth.secret,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'prod',
    },
  });

  server.on('error', logSocketError('http server'));
  io.on('error', logSocketError('server'));

  const mongoose = await connect();

  io.adapter(redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    auth_pass: config.redis.password,
    db: config.redis.db,
  }));

  const middlewares = [
    expressSocketSession(session(mongoose), {
      autoSave: true,
    }),
    authenticateMiddleware,
    loggerMiddleware,
  ];

  initRooms(io, middlewares);
  initDefault(io, middlewares);
  watchNamespaceErrors(io, '/');
  watchNamespaceErrors(io, '/rooms');

  return server.listen(process.env.SOCKETIO_PORT || config.socketio.port);
};

init();
