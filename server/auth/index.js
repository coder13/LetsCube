const express = require('express');
const CustomStrategy = require('passport-custom').Strategy;
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
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
  const tokenURL = `${config.wcaSource}/oauth/token`;
  const userProfileURL = `${config.wcaSource}/api/v0/me`;

  passport.use('custom', new CustomStrategy(async (req, done) => {
    const { code, redirectUri } = req.body;

    if (!code) {
      done(new Error({
        status: 400,
        message: 'Invalid code passed',
      }));
      return;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', config.auth.clientID);
    params.append('client_secret', config.auth.clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    try {
      const tokenRes = await fetch(tokenURL, {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).then(checkStatus).then((data) => data.json());

      const meRes = await fetch(userProfileURL, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${tokenRes.access_token}`,
        },
      }).then(checkStatus).then((data) => data.json());

      if (!meRes) {
        done(new Error({
          error: 'Profile is not defined',
        }));
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
        accessToken: tokenRes.access_token,
        avatar: profile.avatar,
      }, {
        upsert: true,
        useFindAndModify: false,
        new: true,
      }, (err, user) => {
        done(err, user.toObject());
      });
    } catch (e) {
      done(e);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findOne({ id }, (err, user) => {
      done(err, user);
    });
  });

  router.post('/code',
    (req, res, next) => {
      passport.authenticate('custom', (err, user) => {
        if (err) {
          return res.status(500).json(err);
        }

        if (!user) {
          return res.status(401).json({
            message: 'Authentication failed',
          });
        }

        req.login(user, (loginErr) => {
          if (loginErr) {
            return res.json(loginErr);
          }

          res.json(user);
        });
      })(req, res, next);
    });

  router.get('/logout', (req, res) => {
    req.logout();
    res.redirect(req.query.redirect);
  });

  return router;
};
