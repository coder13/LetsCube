const logger = require('../logger');
const { initializePostgres, pool } = require('../postgres');

const run = async () => {
  try {
    if (!(await initializePostgres())) throw new Error('PostgreSQL is unavailable');
    const result = await pool.query('UPDATE app.users SET email = NULL WHERE email IS NOT NULL');
    logger.info(`[PRIVACY] Cleared ${result.rowCount} PostgreSQL user email values`);
    return { postgresCleared: result.rowCount };
  } finally {
    await pool.end();
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
