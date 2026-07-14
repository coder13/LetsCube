const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/auth');
const { createDiscoveryService } = require('../social/discoveryService');
const { apiRateLimitOptions } = require('../middlewares/apiRateLimit');

const sendError = (res, err) => res.status(err.statusCode || 500).json({
  code: err.code || 'user_unavailable',
  message: err.statusCode ? err.message : 'User discovery is temporarily unavailable',
  ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
});

const createUsersRouter = (service = createDiscoveryService()) => {
  const router = express.Router();
  router.use(rateLimit(apiRateLimitOptions()));
  router.use(auth);

  router.get('/search', async (req, res) => {
    try {
      res.json(await service.search(req.user, req.query.q, req.query.limit, req.query.cursor));
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const profile = await service.publicProfile(req.user, req.params.id);
      if (!profile) return res.status(404).json({ code: 'user_not_available', message: 'User not available' });
      return res.json(profile);
    } catch (err) {
      return sendError(res, err);
    }
  });
  return router;
};

module.exports = createUsersRouter;
