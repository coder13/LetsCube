const mongoose = require('mongoose');
const database = require('../database');
const logger = require('../logger');
const { pool } = require('../postgres');
const { purgeUserEmails } = require('./userEmailPurge');

const report = (summary) => {
  logger.info(
    '[PRIVACY] User email purge result: '
      + `MongoDB matched=${summary.mongoMatched} modified=${summary.mongoModified} `
      + `remaining=${summary.mongoRemaining}; PostgreSQL cleared=${summary.postgresCleared} `
      + `remaining=${summary.postgresRemaining}`,
  );
};

const run = async () => {
  const connection = await database.connect();

  try {
    return await purgeUserEmails({
      mongoUsers: connection.connection.collection('users'),
      postgresClient: pool,
      report,
    });
  } finally {
    await Promise.allSettled([
      mongoose.disconnect(),
      pool.end(),
    ]);
  }
};

if (require.main === module) {
  run().catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
};
