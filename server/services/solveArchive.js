const logger = require('../logger');
const { Solve } = require('../models');

function getAttempt(room, attemptId) {
  return room.attempts.find((attempt) => attempt.id === attemptId);
}

function buildSolve(room, attempt, userId, result, editedBy) {
  return {
    room: room._id,
    roomSnapshot: {
      name: room.name,
      event: room.event,
      type: room.type,
    },
    attemptId: attempt.id,
    attempt: attempt._id,
    scrambles: attempt.scrambles,
    userId,
    result,
    editedBy,
  };
}

async function persistSolve(room, attemptId, userId, result, editedBy, options = {}) {
  const attempt = getAttempt(room, attemptId);

  if (!attempt) {
    const err = new Error('Attempted to archive solve for missing attempt');
    logger.error('Attempted to archive solve for missing attempt', {
      roomId: room._id,
      attemptId,
      userId,
    });
    if (options.throwOnError) {
      throw err;
    }
    return;
  }

  try {
    await Solve.updateOne({
      room: room._id,
      attemptId,
      userId,
    }, {
      $set: buildSolve(room, attempt, userId, result, editedBy),
    }, {
      upsert: true,
    });
  } catch (err) {
    logger.error('Failed to archive solve result', {
      err,
      roomId: room._id,
      attemptId,
      userId,
    });
    if (options.throwOnError) {
      throw err;
    }
  }
}

module.exports = {
  persistSolve,
};
