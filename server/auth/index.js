const express = require('express');
const WCAStrategy = require('passport-wca').Strategy;
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const { User } = require('../models');

const checkStatus = async (res) => {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res;
  } else {
    throw await res.json();
  }
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

  passport.use(new WCAStrategy(options,
    (accessToken, refreshToken, profile, done) => {
      User.findOneAndUpdate({
        id: +profile.id,
      }, {
        id: +profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        wcaId: profile.wca.id,
        accessToken,
        avatar: profile._json.me.avatar,
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
    User.findOne({ id }, (err, user) => {
      done(err, user);
    });
  });

  router.get('/code', async (req, res) => {
    const { code, redirectUri } = req.query;
    console.log(48, code, redirectUri);

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
    console.log(69, params);
    fetch('https://staging.worldcubeassociation.org/oauth/token', {
    // fetch('http://localhost:8080/auth/proxy', {
      method: 'POST',
      // body: JSON.stringify({
      //   grant_type: 'authorization_code',
      //   client_id: 'example-application-id',
      //   client_secret: 'example-secret',
      //   redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      //   code: code,
      // }),
      body: params,
      // headers: { 
      //   'Content-Type': 'application/x-www-form-urlencoded',
      // },
      // headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }).then((r) => {
      console.log(r.headers.raw());
      return r;
    })
      // .then((body) => console.log(89, body));
    .then(checkStatus).then((data) => data.json()).then((tokenRes) => {
      console.log(81, tokenRes);
    }).catch((err) => {
      console.log(err);
      res.status(500);
      res.json(err);
    });
  });

  router.post('/proxy', (req, res) => {
    console.log(105, req);
    res.end();
  });

  router.get('/login', (req, res, next) => {
    req.session.redirect = req.query.redirect;
    console.log(req);

    next();
  }, passport.authenticate('wca'));

  router.get('/callback',
    passport.authenticate('wca'),
    (req, res) => {
      console.log(req.session);
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
