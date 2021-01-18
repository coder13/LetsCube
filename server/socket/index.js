const http = require('http');
const config = require('getconfig');
const socketIO = require('socket.io');
const redis = require('socket.io-redis');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const expressSocketSession = require('express-socket.io-session');
const { connect } = require('../database');
const logger = require('../logger');
const { User } = require('../models');
const initRooms = require('./rooms');
const { encodeUser } = require('./utils');

const init = async () => {
  const server = http.createServer();
  const io = socketIO(server, {
    cors: {
      origin: config.cors.origin.map((o) => new RegExp(o)),
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

  const sessionOptions = {
    secret: config.auth.secret,
    saveUninitialized: false, // don't create session until something stored
    resave: false, // don't save session if unmodified,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'prod',
      sameSite: 'strict',
    },
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
    }),
  };

  io.adapter(redis({
    host: 'localhost',
    port: 6379,
  }));

  io.use(expressSocketSession(session(sessionOptions), {
    autoSave: true,
  }));

  io.use(async (socket, next) => {
    const userId = socket.handshake.session.passport
      ? socket.handshake.session.passport.user : null;

    if (!userId) {
      return next();
    }

    socket.userId = userId;

    socket.join(encodeUser(userId));

    try {
      socket.user = await User.findOne({ id: userId });
    } catch (e) {
      logger.error(e, { userId });
    }

    next();
  });

  io.use((socket, next) => {
    socket.onAny((event, data) => {
      logger.info(event, {
        id: socket.id,
        userId: socket.userId,
        roomId: socket.roomId,
        data,
      });
    });

    next();
  });

  initRooms(io);

  return server.listen(process.env.SOCKETIO_PORT || config.socketio.port);
};

init();
