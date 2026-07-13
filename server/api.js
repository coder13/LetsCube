const express = require('express');

const router = express.Router();
const { User } = require('./models');
const auth = require('./middlewares/auth.js');
const createFriendsRouter = require('./api/friends');

const PREFERENCE_KEYS = new Set([
  'showWCAID',
  'preferRealName',
  'useInspection',
  'timerType',
  'muteTimer',
]);

module.exports = () => {
  const sendError = (res, err) => {
    res.status(err.statusCode || 500).send({
      status: err.statusCode,
      message: err.message || 'Error occured while retrieving data; contact Kleb',
    });
  };

  router.get('/me', auth, (req, res) => {
    res.json(req.user.toObject());
  });

  router.use('/friends', createFriendsRouter());

  router.put('/updateUsername', auth, (req, res) => {
    // TODO: server side validation of username
    // TODO: refactor
    const { username } = req.body;
    if (username === undefined) {
      return sendError(res, {
        statusCode: 400,
        message: 'Missing username from request',
      });
    }

    if (username === '') {
      req.user.username = username;
      return req.user.save().then((u) => {
        res.json(u.toObject());
      });
    }

    User.findOne({
      username: {
        $regex: new RegExp(`^${username}$`, 'i'),
      },
    }).then((user) => {
      if (user && user.id !== req.user.id) {
        sendError(res, {
          statusCode: 500,
          message: 'User with username already exists',
        });
        return null;
      }

      req.user.username = username.trim();
      return req.user.save().then((u) => {
        res.json(u.toObject());
      });
    }).catch((err) => {
      sendError(res, {
        statusCode: 500,
        message: err,
      });
    });
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
