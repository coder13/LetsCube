#!/usr/bin/env node
/* eslint-disable no-console */

const { normalizeUsername } = require('../server/username');
const { initializePostgres, pool } = require('../server/postgres');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const unknownArg = [...args].find((arg) => !['--apply', '--create-index'].includes(arg));

const run = async () => {
  if (unknownArg) throw new Error(`Unknown argument: ${unknownArg}`);
  if (!(await initializePostgres())) throw new Error('PostgreSQL is unavailable');

  const { rows } = await pool.query(
    'SELECT id, username, username_normalized FROM app.users ORDER BY wca_user_id',
  );
  const changes = rows.flatMap((row) => {
    const normalized = normalizeUsername(row.username);
    return normalized.usernameNormalized === row.username_normalized
      ? [] : [{ ...row, normalized }];
  });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', pendingChanges: changes.length }, null, 2));

  if (apply) {
    for (const row of changes) {
      await pool.query(`
        UPDATE app.users
        SET username = $2, username_normalized = $3, source_updated_at = now(), ingested_at = now()
        WHERE id = $1
      `, [row.id, row.normalized.username || null, row.normalized.usernameNormalized || null]);
    }
    console.log(`Updated ${changes.length} user records.`);
  }
  return changes.length;
};

if (require.main === module) {
  run().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  }).finally(() => pool.end());
}

module.exports = { run };
