const { Pool } = require('pg');

const config = require('../runtimeConfig');
const logger = require('../logger');

const RETRY_DELAY_MS = 30 * 1000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const SESSION_CLEANUP_BATCH_SIZE = 10_000;
const SESSION_CLEANUP_MAX_BATCHES = 100;

const poolConfig = config.postgres.connectionString
  ? { connectionString: config.postgres.connectionString }
  : {
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
  };

if (config.postgres.ssl) {
  poolConfig.ssl = {
    rejectUnauthorized: config.postgres.sslRejectUnauthorized,
    ...(config.postgres.sslCa ? { ca: config.postgres.sslCa } : {}),
  };
}

const pool = new Pool({
  ...poolConfig,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (err) => {
  logger.error(err);
});

let initialized = false;
let initializationPromise;
let lastFailureAt = 0;
let maintenancePromise;
let maintenanceTimer;

const initializePostgres = async () => {
  if (!config.postgres.enabled) {
    return false;
  }
  if (initialized) {
    return true;
  }
  if (initializationPromise) {
    return initializationPromise;
  }
  if (Date.now() - lastFailureAt < RETRY_DELAY_MS) {
    return false;
  }

  initializationPromise = (async () => {
    await pool.query('SELECT 1');
    initialized = true;
    logger.info('[POSTGRES] Connected');
    return true;
  })().catch((err) => {
    lastFailureAt = Date.now();
    logger.error(err);
    return false;
  }).finally(() => {
    initializationPromise = undefined;
  });

  return initializationPromise;
};

const withTransaction = async (callback) => {
  if (!(await initializePostgres())) {
    return null;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    logger.error(err);
    return null;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const query = async (...args) => {
  if (!(await initializePostgres())) {
    return null;
  }

  try {
    return await pool.query(...args);
  } catch (err) {
    logger.error(err);
    return null;
  }
};

const deleteExpiredMetrics = () => query(
  'DELETE FROM analytics.events WHERE expires_at <= now()',
);

const deleteExpiredSessions = async () => {
  let deleted = 0;

  for (let batch = 0; batch < SESSION_CLEANUP_MAX_BATCHES; batch += 1) {
    // Small transactions keep cleanup from holding one large table lock when
    // a server starts with a large expired-session backlog.
    const result = await query(`
      WITH expired AS (
        SELECT sid
        FROM app.sessions
        WHERE expire <= now()
        ORDER BY expire
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM app.sessions AS sessions
      USING expired
      WHERE sessions.sid = expired.sid
    `, [SESSION_CLEANUP_BATCH_SIZE]);

    if (!result) {
      return deleted;
    }

    deleted += result.rowCount;
    if (result.rowCount < SESSION_CLEANUP_BATCH_SIZE) {
      return deleted;
    }
  }

  return deleted;
};

const runPostgresMaintenance = () => {
  if (maintenancePromise) {
    return maintenancePromise;
  }

  maintenancePromise = Promise.all([
    deleteExpiredMetrics(),
    deleteExpiredSessions(),
  ]).finally(() => {
    maintenancePromise = undefined;
  });

  return maintenancePromise;
};

const startPostgresMaintenance = () => {
  runPostgresMaintenance();
  if (!maintenanceTimer) {
    maintenanceTimer = setInterval(runPostgresMaintenance, MAINTENANCE_INTERVAL_MS);
    maintenanceTimer.unref();
  }
};

const stopPostgresMaintenance = () => {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = undefined;
  }
};

module.exports = {
  deleteExpiredMetrics,
  deleteExpiredSessions,
  initializePostgres,
  pool,
  query,
  runPostgresMaintenance,
  startPostgresMaintenance,
  stopPostgresMaintenance,
  withTransaction,
};
