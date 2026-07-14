#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies, no-console */
const path = require('path');
const mongoose = require('mongoose');

process.env.GETCONFIG_ROOT = process.env.GETCONFIG_ROOT
  || path.join(__dirname, '../server/config');

const config = require('../server/runtimeConfig');
const {
  assertUsernameRolloutReady,
  planUsernameBackfill,
} = require('../server/usernameBackfill');
const { reconcilePostgresUsernames } = require('../server/usernamePostgresBackfill');

const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(['--apply', '--create-index']);
const unknownArg = [...args].find((arg) => !supportedArgs.has(arg));

const duplicateNormalizedUsernames = (collection) => collection.aggregate([
  { $match: { usernameNormalized: { $exists: true } } },
  { $group: { _id: '$usernameNormalized', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $limit: 1 },
]).toArray();

const readUsers = (collection) => collection.find({}, {
  projection: {
    _id: 1,
    id: 1,
    username: 1,
    usernameNormalized: 1,
  },
}).toArray();

let postgresPool;

const run = async () => {
  if (unknownArg) {
    throw new Error(`Unknown argument: ${unknownArg}`);
  }

  const apply = args.has('--apply');
  const createIndex = args.has('--create-index');
  if (createIndex && !apply) {
    throw new Error('--create-index must be used with --apply');
  }

  mongoose.set('strictQuery', false);
  await mongoose.connect(config.mongodb, { autoIndex: false });
  const users = mongoose.connection.collection('users');
  const documents = await readUsers(users);
  const plan = planUsernameBackfill(documents);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    ...plan.report,
  }, null, 2));

  if (!apply) {
    return;
  }

  if (plan.operations.length) {
    const result = await users.bulkWrite(plan.operations, { ordered: false });
    console.log(`Updated ${result.modifiedCount} user records.`);
  }

  const verifiedPlan = planUsernameBackfill(await readUsers(users));
  if (verifiedPlan.report.pendingChanges || verifiedPlan.report.privacyRemoved) {
    throw new Error('MongoDB username backfill verification failed');
  }

  let postgres = { status: 'disabled' };
  if (config.postgres.enabled) {
    // Avoid creating a PostgreSQL pool for dry runs or explicitly disabled mirrors.
    // eslint-disable-next-line global-require
    ({ pool: postgresPool } = require('../server/postgres'));
    postgres = {
      status: 'reconciled',
      ...await reconcilePostgresUsernames({
        client: postgresPool,
        users: verifiedPlan.postgresUsers,
      }),
    };
  }

  console.log(JSON.stringify({
    verification: {
      mongoPendingChanges: verifiedPlan.report.pendingChanges,
      mongoPrivateValuesRemaining: verifiedPlan.report.privacyRemoved,
      postgres,
    },
  }, null, 2));

  if (createIndex) {
    assertUsernameRolloutReady(verifiedPlan.report);
    const duplicates = await duplicateNormalizedUsernames(users);
    if (duplicates.length) {
      throw new Error('Duplicate normalized usernames remain; unique index was not created');
    }
    const name = await users.createIndex(
      { usernameNormalized: 1 },
      { name: 'users_username_normalized_unique', sparse: true, unique: true },
    );
    console.log(`Verified MongoDB index ${name}.`);
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
}).finally(() => Promise.allSettled([
  mongoose.disconnect(),
  ...(postgresPool ? [postgresPool.end()] : []),
]));
