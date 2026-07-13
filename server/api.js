const express = require('express');

const router = express.Router();
const { User } = require('./models');
const auth = require('./middlewares/auth.js');
const { updateUsername } = require('./username');

const PREFERENCE_KEYS = new Set([
  'showWCAID',
  'preferRealName',
  'useInspection',
  'timerType',
  'muteTimer',
]);

module.exports = () => {
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
