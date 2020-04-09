const express = require('express');
const WCAStrategy = require('passport-wca').Strategy;
const { User } = require('../models');
const auth = require('../middlewares/auth');

module.exports = (app, passport) => {
  const router = express.Router();
  const config = app.get('config');
  const options = config.auth;
  options.authorizationURL = `${config.wcaSource}/oauth/authorize`;
  options.tokenURL = `${config.wcaSource}/oauth/token`;
  options.callbackURL = config.auth.callbackURL;
  options.userProfileURL = `${config.wcaSource}/api/v0/me`;
  options.scope = 'email dob public';

  passport.use(new WCAStrategy(options,
    (accessToken, refreshToken, profile, done) => {
      User.findOneAndUpdate({
        id: +profile.id,
      }, {
        id: +profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        wcaId: profile.wca.id,
        accessToken: accessToken,
        avatar: profile._json.me.avatar
      }, {
        upsert: true,
        useFindAndModify: false,
        new: true,
      }, (err, user) => {
        done(err, user);
      });
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findOne({id}, (err, user) => {
      done(err, user);
    });
  });

  router.get('/login', (req, res, next) => {
    req.session.redirect = req.query.redirect;

    next();
  }, passport.authenticate('wca'));

  router.get('/callback',
    passport.authenticate('wca'),
    (req, res) => {
      const redirect = req.session.redirect || '/';
      delete req.session.redirect;

      res.redirect(redirect);
    });

  router.get('/logout', (req, res) => {
    req.logout();
    res.redirect(req.query.redirect);
  });

  return router;
};
