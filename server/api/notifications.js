const express = require('express');
const rateLimit = require('express-rate-limit');

const auth = require('../middlewares/auth');
const notificationService = require('../social/notificationService');
const { apiRateLimitOptions } = require('../middlewares/apiRateLimit');

const sendError = (res, err) => res.status(err.statusCode || 500).json({
  code: err.code || 'internal_error',
  message: err.statusCode ? err.message : 'The notification action could not be completed',
});

const asyncHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    sendError(res, err);
  }
};

const createNotificationsRouter = (service = notificationService) => {
  const router = express.Router();
  router.use(rateLimit(apiRateLimitOptions()));
  router.use(auth);

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await service.list(req.user, req.query));
  }));
  router.post('/read-all', asyncHandler(async (req, res) => {
    res.json(await service.markAllRead(req.user));
  }));
  router.post('/:notificationId/read', asyncHandler(async (req, res) => {
    res.json(await service.markRead(req.user, req.params.notificationId));
  }));

  return router;
};

module.exports = createNotificationsRouter;
