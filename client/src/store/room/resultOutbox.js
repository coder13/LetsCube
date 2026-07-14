import { uuid } from '../../lib/utils';

export const PENDING_RESULT_VERSION = 1;
export const PENDING_RESULT_STORAGE_KEY = 'letscube.pendingResult.v1';

const hasId = (value) => (
  (typeof value === 'string' && value.length > 0)
  || (typeof value === 'number' && Number.isFinite(value))
);

export const isPendingResult = (pendingResult) => (
  !!pendingResult
  && pendingResult.version === PENDING_RESULT_VERSION
  && typeof pendingResult.submissionId === 'string'
  && pendingResult.submissionId.length > 0
  && hasId(pendingResult.userId)
  && hasId(pendingResult.roomId)
  && hasId(pendingResult.attemptId)
  && (pendingResult.attemptKey === undefined || hasId(pendingResult.attemptKey))
  && (pendingResult.deliveryAttempted === undefined
    || typeof pendingResult.deliveryAttempted === 'boolean')
  && (pendingResult.terminalFailure === undefined
    || typeof pendingResult.terminalFailure === 'boolean')
  && (!pendingResult.terminalFailure
    || (!!pendingResult.failure
      && typeof pendingResult.failure === 'object'
      && typeof pendingResult.failure.message === 'string'
      && pendingResult.failure.message.length > 0))
  && !!pendingResult.result
  && typeof pendingResult.result === 'object'
  && typeof pendingResult.result.time === 'number'
  && Number.isFinite(pendingResult.result.time)
  && typeof pendingResult.createdAt === 'number'
  && Number.isFinite(pendingResult.createdAt)
);

export const createPendingResult = ({
  userId,
  roomId,
  attemptId,
  attemptKey,
  result,
}, {
  createId = uuid,
  now = Date.now,
} = {}) => {
  if (!hasId(attemptKey)) {
    throw new Error('A new pending result requires an immutable attempt key.');
  }

  const pendingResult = {
    version: PENDING_RESULT_VERSION,
    submissionId: createId(),
    userId,
    roomId,
    attemptId,
    attemptKey,
    deliveryAttempted: false,
    terminalFailure: false,
    result,
    createdAt: now(),
  };

  if (!isPendingResult(pendingResult)) {
    throw new Error('Cannot create an invalid pending result.');
  }

  return pendingResult;
};

export const markPendingResultAttempted = (pendingResult) => {
  const attemptedResult = {
    ...pendingResult,
    deliveryAttempted: true,
  };

  if (!isPendingResult(attemptedResult)) {
    throw new Error('Cannot mark an invalid pending result as attempted.');
  }

  return attemptedResult;
};

export const markPendingResultFailed = (pendingResult, failure) => {
  const failedResult = {
    ...pendingResult,
    deliveryAttempted: true,
    terminalFailure: true,
    failure,
  };

  if (!isPendingResult(failedResult)) {
    throw new Error('Cannot mark an invalid pending result as failed.');
  }

  return failedResult;
};

export const canDiscardPendingResult = (pendingResult, status) => (
  isPendingResult(pendingResult)
  && (status === 'failed'
    || pendingResult.terminalFailure === true
    || pendingResult.deliveryAttempted !== true)
);

export const readPendingResult = (storage = window.localStorage) => {
  const serialized = storage.getItem(PENDING_RESULT_STORAGE_KEY);
  if (!serialized) {
    return null;
  }

  try {
    const pendingResult = JSON.parse(serialized);
    return isPendingResult(pendingResult) ? pendingResult : null;
  } catch {
    return null;
  }
};

export const persistPendingResult = (pendingResult, storage = window.localStorage) => {
  if (!isPendingResult(pendingResult)) {
    throw new Error('Cannot save an invalid pending result.');
  }

  storage.setItem(PENDING_RESULT_STORAGE_KEY, JSON.stringify(pendingResult));
  return pendingResult;
};

export const clearPendingResult = (submissionId, storage = window.localStorage) => {
  const pendingResult = readPendingResult(storage);

  if (pendingResult && pendingResult.submissionId !== submissionId) {
    return false;
  }

  storage.removeItem(PENDING_RESULT_STORAGE_KEY);
  return true;
};

export const pendingResultMatches = (pendingResult, { userId, roomId }) => (
  isPendingResult(pendingResult)
  && hasId(userId)
  && hasId(roomId)
  && String(pendingResult.userId) === String(userId)
  && String(pendingResult.roomId) === String(roomId)
);

export const pendingResultBelongsToUser = (pendingResult, userId) => (
  isPendingResult(pendingResult)
  && hasId(userId)
  && String(pendingResult.userId) === String(userId)
);
