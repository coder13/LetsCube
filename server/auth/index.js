const express = require('express');
const LocalStrategy = require('passport-local').Strategy;
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const logger = require('../logger');
const { User } = require('../models');

const checkStatus = async (res) => {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res;
  }
  throw await res.json();
};

module.exports = (app, passport) => {
  const router = express.Router();
  const config = app.get('config');
  const options = config.auth;
  options.authorizationURL = `${config.wcaSource}/oauth/authorize`;
  options.tokenURL = `${config.wcaSource}/oauth/token`;
  options.callbackURL = config.auth.callbackURL;
  options.userProfileURL = `${config.wcaSource}/api/v0/me`;
  options.scope = 'email dob public';

  // passport.use(new WCAStrategy(options,
  //   (accessToken, refreshToken, profile, done) => {
  //     User.findOneAndUpdate({
  //       id: +profile.id,
  //     }, {
  //       id: +profile.id,
  //       name: profile.displayName,
  //       email: profile.emails[0].value,
  //       wcaId: profile.wca.id,
  //       accessToken,
  //       avatar: profile._json.me.avatar,
  //     }, {
  //       upsert: true,
  //       useFindAndModify: false,
  //       new: true,
  //     }, (err, user) => {
  //       done(err, user);
  //     });
  //   }));

  passport.use(new LocalStrategy((userId, done) => {
    console.log(46, userId);
    // check to see if the username exists
    User.findOne({
      id: userId,
    })
      .then((user) => {
        if (!user) return done(null, false);
        done(null, user);
      })
      .catch((err) => done(err));
  }));

  passport.serializeUser((user, done) => {
    console.log(59, user);
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findOne({ id }, (err, user) => {
      done(err, user);
    });
  });

  router.get('/code', async (req, res) => {
    const { code, redirectUri } = req.query;

    if (!code) {
      res
        .status(400)
        .send({
          status: 400,
          message: 'Invalid code passed',
        });
      return;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', 'example-application-id');
    params.append('client_secret', 'example-secret');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    try {
      const tokenRes = await fetch('https://staging.worldcubeassociation.org/oauth/token', {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).then(checkStatus).then((data) => data.json());

      const meRes = await fetch('https://staging.worldcubeassociation.org/api/v0/me', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${tokenRes.access_token}`,
        },
      }).then(checkStatus).then((data) => data.json());

      if (!meRes) {
        res.status(500);
        res.json({
          error: 'Profile is not defined',
        });
        return;
      }

      const profile = meRes.me;

      User.findOneAndUpdate({
        id: +profile.id,
      }, {
        id: +profile.id,
        name: profile.name,
        email: profile.email,
        wcaId: profile.wca_id,
        accessToken: tokenRes.accessToken,
        avatar: profile.avatar,
      }, {
        upsert: true,
        useFindAndModify: false,
        new: true,
      }, (err, user) => {
        if (err) {
          logger.error(err);
          return err;
        }

        req.login(user, (e) => {
          if (e) {
            logger.error(e);
            return;
          }

          res.json(user.toObject());
        });
      });
    } catch (e) {
      res.status(500);
      res.json(e);
    }
  });

  router.get('/logout', (req, res) => {
    req.logout();
    res.redirect(req.query.redirect);
  });

  return router;
};
