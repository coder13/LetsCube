const MAX_ATTEMPT_KEY_LENGTH = 128;
const MAX_SUBMISSION_ID_LENGTH = 128;

class ResultSubmissionError extends Error {
  constructor(statusCode, message, retryable, cause) {
    super(message);
    this.name = 'ResultSubmissionError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.cause = cause;
  }

  toResponse() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

const submissionError = (statusCode, message, retryable = false, cause) => (
  new ResultSubmissionError(statusCode, message, retryable, cause)
);

const normalizedPenalties = (penalties = {}) => ({
  AUF: !!penalties.AUF,
  DNF: !!penalties.DNF,
  inspection: !!penalties.inspection,
});

const resultsMatch = (existingResult, incomingResult) => (
  existingResult.time === incomingResult.time
  && Object.entries(normalizedPenalties(existingResult.penalties)).every(([key, value]) => (
    normalizedPenalties(incomingResult.penalties)[key] === value
  ))
);

const validateSubmission = ({
  attemptId, attemptKey, result, submissionId,
}) => {
  if (!Number.isInteger(attemptId) || attemptId < 0) {
    throw submissionError(400, 'Invalid ID for attempt submission');
  }

  if (!result || !Number.isFinite(result.time)) {
    throw submissionError(400, 'Invalid result submission');
  }

  if (result.penalties !== undefined
    && result.penalties !== null
    && (typeof result.penalties !== 'object' || Array.isArray(result.penalties))) {
    throw submissionError(400, 'Invalid result penalties');
  }

  if (submissionId !== undefined
    && (typeof submissionId !== 'string'
      || submissionId.trim().length === 0
      || submissionId.length > MAX_SUBMISSION_ID_LENGTH)) {
    throw submissionError(400, 'Invalid result submission ID');
  }

  if (attemptKey !== undefined
    && (typeof attemptKey !== 'string'
      || attemptKey.trim().length === 0
      || attemptKey.length > MAX_ATTEMPT_KEY_LENGTH)) {
    throw submissionError(400, 'Invalid result attempt key');
  }

  return {
    attemptId,
    attemptKey: attemptKey === undefined ? undefined : attemptKey.trim(),
    result: {
      time: result.time,
      penalties: { ...(result.penalties || {}) },
    },
    submissionId: submissionId === undefined ? undefined : submissionId.trim(),
  };
};

const createResultSubmissionService = ({
  advanceRoom = async (room) => room,
  fetchRoom,
}) => {
  const queues = new Map();

  const enqueue = (key, task) => {
    const previous = queues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    queues.set(key, current);
    current.finally(() => {
      if (queues.get(key) === current) {
        queues.delete(key);
      }
    }).catch(() => {});
    return current;
  };

  const submit = ({
    roomId,
    userId,
    attemptId,
    attemptKey,
    result,
    submissionId,
    onSaved = () => {},
  }) => {
    const submission = validateSubmission({
      attemptId, attemptKey, result, submissionId,
    });
    const userKey = userId.toString();
    const queueKey = roomId.toString();

    return enqueue(queueKey, async () => {
      try {
        const room = await fetchRoom(roomId);
        if (!room) {
          throw submissionError(404, 'Could not find room for result submission');
        }

        if (!room.inRoom.get(userKey) || room.banned.get(userKey)) {
          throw submissionError(403, 'Not authorized to submit a result to this room');
        }

        const attempt = room.attempts[submission.attemptId];
        if (!attempt) {
          throw submissionError(400, 'Invalid ID for attempt submission');
        }
        if (submission.attemptKey !== undefined
          && (!attempt._id || attempt._id.toString() !== submission.attemptKey)) {
          throw submissionError(409, 'Attempt changed before result submission');
        }

        if (room.type === 'grand_prix') {
          submission.result.penalties.DNF = submission.result.penalties.DNF
            || submission.attemptId < room.attempts.length - 1;
        }

        const previousResult = attempt.results.get(userKey);
        let outcome;
        if (previousResult) {
          if (submission.submissionId
            && previousResult.submissionId === submission.submissionId) {
            outcome = {
              room,
              result: previousResult,
              status: 'duplicate',
              submissionId: submission.submissionId,
            };
          } else if (submission.submissionId
            && !previousResult.submissionId
            && resultsMatch(previousResult, submission.result)) {
            previousResult.submissionId = submission.submissionId;
            if (typeof room.markModified === 'function') {
              room.markModified(`attempts.${submission.attemptId}.results.${userKey}`);
            }
            const savedRoom = await room.save();
            outcome = {
              room: savedRoom,
              result: savedRoom.attempts[submission.attemptId].results.get(userKey),
              status: 'duplicate',
              submissionId: submission.submissionId,
            };
          } else {
            throw submissionError(409, 'A result already exists for this attempt');
          }
        } else {
          const storedResult = {
            ...submission.result,
            ...(submission.submissionId ? { submissionId: submission.submissionId } : {}),
          };
          attempt.results.set(userKey, storedResult);
          if (submission.attemptId === room.attempts.length - 1) {
            room.waitingFor.set(userKey, false);
          }

          const savedRoom = await room.save();
          outcome = {
            room: savedRoom,
            result: savedRoom.attempts[submission.attemptId].results.get(userKey),
            status: 'saved',
            submissionId: submission.submissionId,
          };
          await onSaved(outcome);
        }

        if (typeof outcome.room.doneWithScramble === 'function'
          && outcome.room.doneWithScramble()) {
          try {
            outcome.room = await advanceRoom(outcome.room);
          } catch (err) {
            throw submissionError(
              503,
              'Result saved, but failed to advance the room',
              true,
              err,
            );
          }
        }

        return outcome;
      } catch (err) {
        if (err instanceof ResultSubmissionError) {
          throw err;
        }
        throw submissionError(503, 'Failed to save result', true, err);
      }
    });
  };

  return { submit };
};

module.exports = {
  createResultSubmissionService,
  ResultSubmissionError,
  resultsMatch,
  validateSubmission,
};
