const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const config = require('../runtimeConfig');

module.exports = (mongoose) => session({
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
});
