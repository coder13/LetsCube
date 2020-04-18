const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('getconfig');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const logger = require('./logger');
const initSocket = require('./socket');
const auth = require('./auth');
const api = require('./api');

Error.stackTraceLimit = 100;

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV === 'prod');

  app.use(express.json()); // for parsing application/json
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  app.use(bodyParser.urlencoded({
    extended: true,
  }));
  app.use(bodyParser.json());

  logger.debug('[MONGODB] Attempting to connect to database.', { url: config.mongodb });
  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    logger.debug('[MONGODB] Connected to database.', { url: config.mongodb });
  }).catch((err) => {
    logger.error('[MONGODB] Error when connecting to database', err);
    process.exit();
  });

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

  initSocket({ app, expressSession }).listen(9000);

  /* Cors */

  app.use(cors({
    origin: '*',
    credentials: true,
  }));

  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });

  app.use('/auth', auth(app, passport));
  app.use('/api', api(app));

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
