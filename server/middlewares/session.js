const session = require('express-session');

const config = require('../runtimeConfig');
const PostgresSessionStore = require('../postgres/sessionStore');

module.exports = session({
  secret: config.auth.secret,
  saveUninitialized: false, // don't create session until something stored
  resave: false, // don't save session if unmodified,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'prod',
    sameSite: 'strict',
  },
  store: new PostgresSessionStore(),
});
