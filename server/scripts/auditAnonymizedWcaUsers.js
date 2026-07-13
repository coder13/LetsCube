/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('../runtimeConfig');
const { connect } = require('../database');
const { User } = require('../models');
const {
  DEFAULT_DELAY_MS,
  auditWcaUsers,
  candidatesToCsv,
} = require('../services/wcaAnonymizationAudit');

const argumentValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const reportFilename = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `wca-anonymization-candidates-${timestamp}.csv`;
};

const main = async () => {
  const configuredOutput = argumentValue('--output');
  if (process.argv.includes('--output') && !configuredOutput) {
    throw new Error('--output requires a file path');
  }
  const outputPath = path.resolve(configuredOutput || reportFilename());
  const configuredDelay = Number(process.env.WCA_AUDIT_DELAY_MS);
  const delayMs = Number.isFinite(configuredDelay) && configuredDelay >= 0
    ? configuredDelay : DEFAULT_DELAY_MS;

  console.log(`WCA origin: ${config.wcaSource}`);
  console.log('This audit is read-only; only HTTP 404 responses become candidates.');

  await connect();
  try {
    const users = await User.find({
      wcaId: { $exists: true, $nin: [null, ''] },
      anonymizedAt: { $exists: false },
    })
      .select('id wcaId name username')
      .sort({ id: 1 })
      .lean();

    const skipped = await User.countDocuments({
      $or: [
        { wcaId: { $exists: false } },
        { wcaId: null },
        { wcaId: '' },
        { anonymizedAt: { $exists: true } },
      ],
    });

    const result = await auditWcaUsers({
      users,
      wcaSource: config.wcaSource.replace(/\/$/, ''),
      delayMs,
    });
    fs.writeFileSync(outputPath, candidatesToCsv(result.candidates), {
      flag: 'wx',
      mode: 0o600,
    });

    result.errors.forEach((error) => {
      console.error(`Lookup error for ${error.internalId} (${error.wcaId}): ${error.reason}`);
    });
    console.log(`Checked: ${result.checked}`);
    console.log(`Profiles present: ${result.present}`);
    console.log(`Candidates: ${result.candidates.length}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Candidate CSV: ${outputPath}`);

    if (result.errors.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
