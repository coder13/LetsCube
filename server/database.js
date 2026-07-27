const mongoose = require('mongoose');

const logger = require('./logger');
const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1/letscube';

module.exports.connect = async () => {
  logger.debug('[MONGODB] Attempting to connect to migration source.', { url: mongoUrl });

  mongoose.set('strictQuery', false);

  await mongoose.connect(mongoUrl).then(() => {
    logger.debug('[MONGODB] Connected to migration source.', { url: mongoUrl });
  }).catch((err) => {
    logger.error('[MONGODB] Error when connecting to database', err);
    process.exit(1);
  });

  return mongoose;
};
