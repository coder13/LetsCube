const path = require('path');
const express = require('express');
const config = require('getconfig');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cookieSession = require('cookie-session');
const MongoStore = require('connect-mongo')(session);
const { NotFound } = require('rest-api-errors');

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV !== 'prod');

  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }))

  /* Logging */

  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
    stream: process.stdout
  }));

  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode >= 400,
    stream: process.stderr
  }));

  /* Auth */

  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
  });

  app.use(cookieSession({
    name: 'session',
    secret: config.auth.secret,
    signed: false
  }))

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.static(path.join(__dirname, '../build')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });

  app.use('/auth/', require('./auth')(app, passport));


  app.use('/*', () => {
    throw new NotFound();
  });

  mongoose.connect(config.mongodb, {
    useNewUrlParser: true
  });

  const server = app.listen(config.server.port, '0.0.0.0', (err) => {
    if (err) {
      console.log(err);
    }

    console.log(`Listening on port ${config.server.port}. Access at: http://localhost:${config.server.port}/`);
  });

};

init().catch(err => {
  console.error(err);
})