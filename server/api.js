const _ = require('lodash');
const express = require('express');
const router = express.Router();
const { User } = require('./models');
const auth = require('./middlewares/auth.js');

const userMask = _.partial(_.pick,  _, ['id', 'name', 'username', 'email', 'wcaId', 'avatar']);

module.exports = (app) => {
  const sendError = (res, err) => {
    res.status(err.statusCode || 500).send({
      status: err.statusCode,
      message: err.message || 'Error occured while retrieving data; contact Kleb'
    });
  };

  router.get('/me', auth, (req, res) => {
    res.json(userMask(req.user));
  });

  router.put('/updateUsername', auth, (req, res) => {
    // TODO: server side validation of username
    // TODO: refactor
    const { username } = req.body;
    if (!req.body.username) {
      return sendError(res, {
        statusCode: 400,
        message: 'Missing username from request',
      });  
    }

    User.findOne({
      username: req.body.username
    }).then((user) => {
      if (user) {
        sendError(res, {
          statusCode: 500,
          message: 'User with username already exists',
        });
        return null;
      }

      req.user.username = req.body.username.trim();
      return req.user.save().then((u) => {
        res.json({
          username: u.username,
        });
      });
    }).catch((err) => {
      sendError(res, {
        statusCode: 500,
        message: err
      });
    });
  });

  return router;
}