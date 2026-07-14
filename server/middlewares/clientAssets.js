const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { apiRateLimitOptions } = require('./apiRateLimit');

const createClientAssetsRouter = (buildPath, rateLimitOptions = apiRateLimitOptions()) => {
  const router = express.Router();

  router.use(rateLimit(rateLimitOptions));
  router.use(express.static(buildPath));
  const indexPath = path.join(buildPath, 'index.html');

  router.get('/', (req, res) => res.sendFile(indexPath));
  router.use((req, res) => res.sendFile(indexPath));

  return router;
};

module.exports = { createClientAssetsRouter };
