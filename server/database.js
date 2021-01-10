const config = require('getconfig');
const mongoose = require('mongoose');
const logger = require('./logger');

module.exports.connect = async () => {
  logger.debug('[MONGODB] Attempting to connect to database.', { url: config.mongodb });

  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    logger.debug('[MONGODB] Connected to database.', { url: config.mongodb });
  }).catch((err) => {
    logger.error('[MONGODB] Error when connecting to database', err);
    process.exit();
  });

  return mongoose;
};
