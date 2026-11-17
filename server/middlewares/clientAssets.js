const express = require('express');
const path = require('path');

const createClientAssetsRouter = (buildPath) => {
  const router = express.Router();

  router.use(express.static(buildPath));
  const indexPath = path.join(buildPath, 'index.html');

  router.get('/', (req, res) => res.sendFile(indexPath));
  router.use((req, res) => res.sendFile(indexPath));

  return router;
};

module.exports = { createClientAssetsRouter };
