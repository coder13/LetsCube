const mongoose = require('mongoose');

const config = require('./runtimeConfig');
const logger = require('./logger');

module.exports.connect = async () => {
  logger.debug('[MONGODB] Attempting to connect to database.', { url: config.mongodb });

  mongoose.set('strictQuery', false);

  await mongoose.connect(config.mongodb).then(() => {
    logger.debug('[MONGODB] Connected to database.', { url: config.mongodb });
  }).catch((err) => {
    logger.error('[MONGODB] Error when connecting to database', err);
    process.exit(1);
  });

  return mongoose;
};
