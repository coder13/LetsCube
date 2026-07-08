const { connect } = require('../database');
const logger = require('../logger');
const { Room } = require('../models');
const { persistSolve } = require('../services/solveArchive');

function resultEntries(attempt) {
  if (!attempt.results) {
    return [];
  }

  if (attempt.results instanceof Map) {
    return [...attempt.results.entries()];
  }

  return Object.keys(attempt.results).map((userId) => [userId, attempt.results[userId]]);
}

async function backfillSolves() {
  await connect();

  let rooms = 0;
  let attempts = 0;
  let solves = 0;

  const roomsToBackfill = await Room.find();
  const solveWrites = [];

  roomsToBackfill.forEach((room) => {
    rooms += 1;

    room.attempts.forEach((attempt) => {
      attempts += 1;

      resultEntries(attempt).forEach(([userId, result]) => {
        solves += 1;
        solveWrites.push(persistSolve(room, attempt.id, Number(userId), result, undefined, {
          throwOnError: true,
        }));
      });
    });
  });

  await Promise.all(solveWrites);

  logger.info('Finished backfilling persisted solves', {
    rooms,
    attempts,
    solves,
  });
}

if (require.main === module) {
  backfillSolves()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Failed to backfill persisted solves', err);
      process.exit(1);
    });
}

module.exports = backfillSolves;
