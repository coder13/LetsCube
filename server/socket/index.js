const http = require('http');
const config = require('getconfig');
const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
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

  const pubClient = createClient({ url: 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  pubClient.on('error', logSocketError('redis pub client'));
  subClient.on('error', logSocketError('redis sub client'));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

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
