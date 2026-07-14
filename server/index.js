const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');

const config = require('./runtimeConfig');
const { connect } = require('./database');
const { createHealthHandler, createHealthReporter } = require('./health');
const { initializePostgres, pool, startPostgresMaintenance } = require('./postgres');
const session = require('./middlewares/session');
const logger = require('./logger');
const auth = require('./auth');
const api = require('./api');
const { isUserApiRequest } = require('./requestLogging');

Error.stackTraceLimit = 100;

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV === 'prod');

  app.use(express.json()); // for parsing application/json
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  const mongoose = await connect();
  await initializePostgres();
  startPostgresMaintenance();

  const reportHealth = createHealthReporter({
    service: 'api',
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
    },
  });

  app.get('/health/api', createHealthHandler(reportHealth));

  /* Logging */

  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode >= 400 || isUserApiRequest(req),
    stream: { write: (message) => logger.info(message) },
  }));

  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400 || isUserApiRequest(req),
    stream: { write: (message) => logger.error(message) },
  }));

  /* Auth */

  app.set('trust proxy', 1);

  app.use(session);

  app.use(passport.initialize());
  app.use(passport.session());

  /* Cors */

  app.use(cors({
    credentials: true,
    origin: true,
    // config.cors.origin.map((o) => new RegExp(o)),
  }));

  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });

  app.use('/auth', auth(app, passport));
  app.use('/api', api(app, passport));

  app.get('/api/announcements', (req, res) => {
    const announcementsPath = path.join(__dirname, './announcements');

    if (!fs.existsSync(announcementsPath)) {
      res.type('text/plain').send('');
      return;
    }

    res.sendFile(announcementsPath);
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
