const path = require('path');
const express = require('express');
const config = require('getconfig');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const { connect } = require('./database');
const logger = require('./logger');
const auth = require('./auth');
const api = require('./api');
const { Room } = require('./models');

Error.stackTraceLimit = 100;

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV === 'prod');

  app.use(express.json()); // for parsing application/json
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  const mongoose = await connect();

  /* Logging */

  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode >= 400,
    stream: { write: (message) => logger.info(message) },
  }));

  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: (message) => logger.error(message) },
  }));

  /* Auth */

  app.set('trust proxy', 1);
  const sessionOptions = {
    secret: config.auth.secret,
    saveUninitialized: false, // don't create session until something stored
    resave: false, // don't save session if unmodified,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: app.get('prod'),
      sameSite: 'strict',
    },
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
    }),
  };

  const expressSession = session(sessionOptions);

  app.use(expressSession);

  app.use(passport.initialize());
  app.use(passport.session());

  /* Cors */

  app.use(cors({
    credentials: true,
    origin: config.cors.origin.map((o) => new RegExp(o)),
  }));

  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });

  app.use('/auth', auth(app, passport));
  app.use('/api', api(app, passport));

  app.get('/api/announcements', (req, res) => {
    res.sendFile(path.join(__dirname, './announcements'));
  });

  app.use('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });

  app.listen(config.server.port, '0.0.0.0', (err) => {
    if (err) {
      logger.error(err);
    }

    logger.info('[EXPRESS] Listening...', {
      port: config.server.port,
    });
  });

  return app;
};

try {
  const app = init();
  module.exports = app;
} catch (e) {
  logger.error(e);
}

/* eslint-disable no-await-in-loop */
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index += 1) {
    await callback(array[index], index, array);
  }
}

process.on('SIGINT', () => {
  Room.find().then(async (rooms) => {
    try {
      await asyncForEach(rooms, async (room) => {
        await asyncForEach(room.users, async (user) => {
          await room.dropUser(user);
        });
      });
    } catch (e) {
      logger.error(e);
    }

    process.exit(0);
  });
});
