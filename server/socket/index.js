const http = require('http');
const config = require('getconfig');
const socketIO = require('socket.io');
const redis = require('socket.io-redis');
const expressSocketSession = require('express-socket.io-session');
const session = require('../middlewares/session');
const { connect } = require('../database');
const loggerMiddleware = require('./middlewares/logger');
const authenticateMiddleware = require('./middlewares/authenticate');
const initRooms = require('./namespaces/rooms');
const initDefault = require('./namespaces/default');

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

  const mongoose = await connect();

  io.adapter(redis({
    host: 'localhost',
    port: 6379,
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

  return server.listen(process.env.SOCKETIO_PORT || config.socketio.port);
};

init();
