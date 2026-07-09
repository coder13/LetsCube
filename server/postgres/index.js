/* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const config = require('../runtimeConfig');
const logger = require('../logger');

const RETRY_DELAY_MS = 30 * 1000;
const MIGRATION_LOCK_NAME = 'letscube-postgres-migrations';

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

const migrationFiles = () => fs.readdirSync(path.join(__dirname, 'migrations'))
  .filter((file) => file.endsWith('.sql'))
  .sort();

const runMigrations = async (client) => {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set((await client.query(
      'SELECT filename FROM app.schema_migrations',
    )).rows.map(({ filename }) => filename));

    for (const filename of migrationFiles()) {
      if (applied.has(filename)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(__dirname, 'migrations', filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO app.schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME]);
  }
};

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
    const client = await pool.connect();
    try {
      await runMigrations(client);
      initialized = true;
      logger.info('[POSTGRES] Connected and migrations are current');
      return true;
    } finally {
      client.release();
    }
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

const startPostgresMaintenance = () => {
  deleteExpiredMetrics();
  const timer = setInterval(deleteExpiredMetrics, 6 * 60 * 60 * 1000);
  timer.unref();
};

module.exports = {
  deleteExpiredMetrics,
  initializePostgres,
  pool,
  query,
  startPostgresMaintenance,
  withTransaction,
};
