const express = require('express');
const rateLimit = require('express-rate-limit');

const auth = require('../middlewares/auth');
const relationshipService = require('../social/relationshipService');
const { apiRateLimitOptions } = require('../middlewares/apiRateLimit');

const sendError = (res, err) => res.status(err.statusCode || 500).json({
  code: err.code || 'internal_error',
  message: err.statusCode ? err.message : 'The relationship action could not be completed',
  ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
});

const asyncHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    sendError(res, err);
  }
};

const createFriendsRouter = (service = relationshipService) => {
  const router = express.Router();
  router.use(rateLimit(apiRateLimitOptions()));
  router.use(auth);

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await service.list(req.user));
  }));

  router.post('/requests', asyncHandler(async (req, res) => {
    const result = await service.sendRequest(req.user, req.body.userId);
    const status = result.outcome === 'request_created' ? 201 : 200;
    res.status(status).json(result);
  }));

  router.delete('/requests/:userId', asyncHandler(async (req, res) => {
    await service.cancelRequest(req.user, req.params.userId);
    res.status(204).end();
  }));

  router.post('/requests/:userId/accept', asyncHandler(async (req, res) => {
    res.json(await service.acceptRequest(req.user, req.params.userId));
  }));

  router.post('/requests/:userId/decline', asyncHandler(async (req, res) => {
    await service.declineRequest(req.user, req.params.userId);
    res.status(204).end();
  }));

  router.delete('/:userId', asyncHandler(async (req, res) => {
    await service.unfriend(req.user, req.params.userId);
    res.status(204).end();
  }));

  router.put('/blocks/:userId', asyncHandler(async (req, res) => {
    await service.block(req.user, req.params.userId);
    res.status(204).end();
  }));

  router.delete('/blocks/:userId', asyncHandler(async (req, res) => {
    await service.unblock(req.user, req.params.userId);
    res.status(204).end();
  }));

  return router;
};

module.exports = createFriendsRouter;
