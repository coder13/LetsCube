const _ = require('lodash');
const express = require('express');
const WCAStrategy = require('passport-wca').Strategy;
const OAuthStrategy = require('passport-oauth2');
const { User } = require('../models');
const auth = require('../middlewares/auth');

module.exports = (app, passport) => {
  const router = express.Router();
  const config = app.get('config');
  const options = config.auth;
  options.authorizationURL = `${config.wcaSource}/oauth/authorize`;
  options.tokenURL = `${config.wcaSource}/oauth/token`;
  options.callbackURL = `http://localhost:8080/auth/callback`;
  options.userProfileURL = `${config.wcaSource}/api/v0/me`;
  options.scope = 'email dob public';

  passport.use(new WCAStrategy(options,
    (accessToken, refreshToken, profile, done) => {
      User.findOneAndUpdate({
        id: profile.id,
      }, {
        id: +profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        wcaId: profile.wca.id,
        accessToken: accessToken,
      }, {
        upsert: true,
        useFindAndModify: false
      }, (err, user) => done(err, user)
    );
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findOne({id}, (err, user) => {
      done(err, user);
    });
  });

  // Middleware to check if the user is authenticated
  function isUserAuthenticated(req, res, next) {
    if (req.user) {
      next();
    } else {
      res.status(403);
      res.send('You must login!');
    }
  }

  router.get('/login', (req, res, next) => {
    req.session.redirect = req.query.redirect;

    next();
  }, passport.authenticate('wca', {
    failureRedirect: '/61',
  }));

  router.get('/callback',
    passport.authenticate('wca', {
      failureRedirect: '/66',
    }),
    (req, res) => {
      let redirect = req.session.redirect;
      delete req.session.redirect;

      res.redirect(redirect);
    });

  router.get('/logout', (req, res) => {
    req.logout();
    res.redirect(req.session.redirect);
  });

  const userMask = _.partial(_.pick,  _, ['id', 'name', 'email', 'wcaId']);
  app.get('/api/me', isUserAuthenticated, (req, res) => {
    res.json(userMask(req.user));
  });

  return router;
};