const express = require('express');
const rateLimit = require('express-rate-limit');

const { User } = require('./models');
const auth = require('./middlewares/auth.js');
const { updateUsername } = require('./username');
const createFriendsRouter = require('./api/friends');
const createNotificationsRouter = require('./api/notifications');
const createUsersRouter = require('./api/users');
const { isFeatureEnabled } = require('./features');
const { apiRateLimitOptions } = require('./middlewares/apiRateLimit');

const PREFERENCE_KEYS = new Set([
  'showWCAID',
  'preferRealName',
  'useInspection',
  'timerType',
  'muteTimer',
]);

module.exports = (app) => {
  const router = express.Router();
  router.use(rateLimit(apiRateLimitOptions()));
  const sendError = (res, err) => {
    const body = {
      status: err.statusCode,
      message: err.message || 'Error occured while retrieving data; contact Kleb',
    };
    if (err.code) {
      body.code = err.code;
    }
    res.status(err.statusCode || 500).send(body);
  };

  router.get('/me', auth, (req, res) => {
    res.json(req.user.toObject());
  });

  router.put('/updateUsername', auth, async (req, res) => {
    try {
      const user = await updateUsername(User, req.user, req.body.username);
      return res.json(user.toObject());
    } catch (err) {
      return sendError(res, err);
    }
  });

  if (app && app.get('config').socialFeatures.enabled && isFeatureEnabled('friends')) {
    router.use('/friends', createFriendsRouter());
    router.use('/notifications', createNotificationsRouter());
    router.use('/users', createUsersRouter());
  } else {
    router.use('/friends', (req, res) => res.status(404).json({
      code: 'feature_disabled',
      message: 'This feature is not available',
    }));
    router.use('/notifications', (req, res) => res.status(404).json({
      code: 'feature_disabled',
      message: 'This feature is not available',
    }));
    router.use('/users', (req, res) => res.status(404).json({
      code: 'feature_disabled',
      message: 'This feature is not available',
    }));
  }

  router.put('/updatePreference', auth, async (req, res) => {
    const unknownPreference = Object.keys(req.body)
      .find((key) => !PREFERENCE_KEYS.has(key));
    if (unknownPreference) {
      return sendError(res, {
        statusCode: 400,
        message: `Invalid preference: ${unknownPreference}`,
      });
    }

    try {
      Object.keys(req.body).forEach((key) => {
        req.user[key] = req.body[key];
      });

      const user = await req.user.save();

      return res.json(user.toObject());
    } catch (err) {
      return sendError(res, err);
    }
  });

  return router;
};
