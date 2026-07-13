import {
  PENDING_RESULT_STORAGE_KEY,
  canDiscardPendingResult,
  clearPendingResult,
  createPendingResult,
  markPendingResultAttempted,
  markPendingResultFailed,
  pendingResultBelongsToUser,
  pendingResultMatches,
  persistPendingResult,
  readPendingResult,
} from './resultOutbox';

const makePendingResult = (overrides = {}) => createPendingResult({
  userId: 42,
  roomId: 'room-one',
  attemptId: 12,
  attemptKey: 'attempt-one',
  result: {
    time: 1234,
    penalties: {},
  },
  ...overrides,
}, {
  createId: () => 'submission-one',
  now: () => 1000,
});

describe('result outbox storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores the complete pending result', () => {
    const pendingResult = makePendingResult();

    persistPendingResult(pendingResult);

    const serialized = window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY);
    expect(JSON.parse(serialized)).toEqual(pendingResult);
    expect(readPendingResult()).toEqual(pendingResult);
  });

  it('only clears the matching submission', () => {
    const pendingResult = makePendingResult();
    persistPendingResult(pendingResult);

    expect(clearPendingResult('another-submission')).toBe(false);
    expect(readPendingResult()).toEqual(pendingResult);

    expect(clearPendingResult(pendingResult.submissionId)).toBe(true);
    expect(readPendingResult()).toBeNull();
  });

  it('matches both user and room before allowing automatic submission', () => {
    const pendingResult = makePendingResult();

    expect(pendingResultBelongsToUser(pendingResult, '42')).toBe(true);
    expect(pendingResultMatches(
      pendingResult,
      { userId: '42', roomId: 'room-one' },
    )).toBe(true);
    expect(pendingResultMatches(pendingResult, { userId: 7, roomId: 'room-one' })).toBe(false);
    expect(pendingResultMatches(pendingResult, { userId: 42, roomId: 'room-two' })).toBe(false);
  });

  it('does not restore malformed storage data', () => {
    window.localStorage.setItem(PENDING_RESULT_STORAGE_KEY, '{not-json');
    expect(readPendingResult()).toBeNull();

    window.localStorage.setItem(PENDING_RESULT_STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(readPendingResult()).toBeNull();
  });

  it('restores legacy pending results without an attempt key', () => {
    const pendingResult = makePendingResult();
    delete pendingResult.attemptKey;
    window.localStorage.setItem(
      PENDING_RESULT_STORAGE_KEY,
      JSON.stringify(pendingResult),
    );

    expect(readPendingResult()).toEqual(pendingResult);
  });

  it('requires new pending results to identify the immutable attempt', () => {
    expect(() => makePendingResult({ attemptKey: undefined })).toThrow(
      'requires an immutable attempt key',
    );
  });

  it.each([undefined, Number.NaN])('rejects an invalid result time', (time) => {
    expect(() => makePendingResult({
      result: { time, penalties: {} },
    })).toThrow('Cannot create an invalid pending result');
  });

  it('protects a result from discard after delivery starts', () => {
    const pendingResult = makePendingResult();
    const attemptedResult = markPendingResultAttempted(pendingResult);

    expect(canDiscardPendingResult(pendingResult, 'pending')).toBe(true);
    expect(attemptedResult.deliveryAttempted).toBe(true);
    expect(canDiscardPendingResult(attemptedResult, 'sending')).toBe(false);
    expect(canDiscardPendingResult(attemptedResult, 'pending')).toBe(false);
    expect(canDiscardPendingResult(attemptedResult, 'failed')).toBe(true);
  });

  it('persists a terminal failure as safe to discard', () => {
    const failedResult = markPendingResultFailed(makePendingResult(), {
      statusCode: 409,
      message: 'A result already exists for this attempt',
      retryable: false,
    });
    persistPendingResult(failedResult);

    const restoredResult = readPendingResult();
    expect(restoredResult).toEqual(failedResult);
    expect(canDiscardPendingResult(restoredResult, 'pending')).toBe(true);
  });
});
