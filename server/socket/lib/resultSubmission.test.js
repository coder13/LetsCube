/* eslint-env jest */

const {
  createResultSubmissionService,
  ResultSubmissionError,
  validateSubmission,
} = require('./resultSubmission');

const makeRoom = ({
  attempts = 1,
  existingResult,
  inRoom = true,
  banned = false,
  type = 'normal',
} = {}) => {
  const room = {
    _id: 'room-123',
    type,
    inRoom: new Map([['42', inRoom], ['43', inRoom]]),
    banned: new Map([['42', banned], ['43', banned]]),
    waitingFor: new Map([['42', true], ['43', true]]),
    attempts: Array.from({ length: attempts }, (_, id) => ({
      _id: `attempt-${id}`,
      id,
      results: new Map(),
    })),
  };
  if (existingResult) {
    room.attempts[0].results.set('42', existingResult);
  }
  room.save = jest.fn().mockImplementation(async () => room);
  return room;
};

const submit = (service, overrides = {}) => service.submit({
  roomId: 'room-123',
  userId: 42,
  attemptId: 0,
  result: {
    time: 12345,
    penalties: { AUF: false },
  },
  submissionId: 'submission-123',
  ...overrides,
});

describe('result submission validation', () => {
  it('accepts legacy submissions without an id', () => {
    expect(validateSubmission({
      attemptId: 0,
      result: { time: 1234, penalties: {} },
    })).toEqual({
      attemptId: 0,
      attemptKey: undefined,
      result: { time: 1234, penalties: {} },
      submissionId: undefined,
    });
  });

  it.each([
    [{ attemptId: -1, result: { time: 1234 } }, 'Invalid ID for attempt submission'],
    [{ attemptId: 0, result: { time: Number.NaN } }, 'Invalid result submission'],
    [{ attemptId: 0, result: { time: 1234 }, submissionId: '' }, 'Invalid result submission ID'],
    [{ attemptId: 0, attemptKey: 123, result: { time: 1234 } }, 'Invalid result attempt key'],
  ])('rejects invalid submission payloads', (payload, message) => {
    expect(() => validateSubmission(payload)).toThrow(message);
  });
});

describe('createResultSubmissionService', () => {
  it('persists a result before reporting it as saved', async () => {
    const room = makeRoom();
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service)).resolves.toMatchObject({
      room,
      status: 'saved',
      submissionId: 'submission-123',
    });
    expect(room.save).toHaveBeenCalledTimes(1);
    expect(room.waitingFor.get('42')).toBe(false);
    expect(room.attempts[0].results.get('42')).toMatchObject({
      time: 12345,
      penalties: { AUF: false },
      submissionId: 'submission-123',
    });
  });

  it('accepts a matching immutable attempt key', async () => {
    const room = makeRoom();
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service, { attemptKey: 'attempt-0' })).resolves.toMatchObject({
      status: 'saved',
    });
  });

  it('rejects a reused attempt number when the immutable attempt key changed', async () => {
    const room = makeRoom();
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service, { attemptKey: 'attempt-before-event-reset' }))
      .rejects.toMatchObject({
        statusCode: 409,
        retryable: false,
      });
    expect(room.save).not.toHaveBeenCalled();
  });

  it('treats the same submission id as a duplicate without saving again', async () => {
    const existingResult = {
      time: 12345,
      penalties: {},
      submissionId: 'submission-123',
    };
    const room = makeRoom({ existingResult });
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service)).resolves.toEqual({
      room,
      result: existingResult,
      status: 'duplicate',
      submissionId: 'submission-123',
    });
    expect(room.save).not.toHaveBeenCalled();
  });

  it('adopts an id for an identical result saved by an older server', async () => {
    const existingResult = {
      time: 12345,
      penalties: { DNF: false, inspection: false },
    };
    const room = makeRoom({ existingResult });
    room.markModified = jest.fn();
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service, {
      result: {
        time: 12345,
        penalties: { AUF: false },
      },
    })).resolves.toMatchObject({
      status: 'duplicate',
      submissionId: 'submission-123',
    });
    expect(existingResult.submissionId).toBe('submission-123');
    expect(room.markModified).toHaveBeenCalledWith('attempts.0.results.42');
    expect(room.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatched result saved by an older server', async () => {
    const existingResult = {
      time: 11111,
      penalties: {},
    };
    const room = makeRoom({ existingResult });
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service)).rejects.toMatchObject({
      statusCode: 409,
      retryable: false,
    });
    expect(existingResult.submissionId).toBeUndefined();
    expect(room.save).not.toHaveBeenCalled();
  });

  it('rejects a conflicting result without overwriting it', async () => {
    const existingResult = {
      time: 11111,
      penalties: {},
      submissionId: 'older-submission',
    };
    const room = makeRoom({ existingResult });
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service)).rejects.toMatchObject({
      statusCode: 409,
      retryable: false,
    });
    expect(room.attempts[0].results.get('42')).toBe(existingResult);
    expect(room.save).not.toHaveBeenCalled();
  });

  it('allows submission to an original attempt after the room advances', async () => {
    const room = makeRoom({ attempts: 2 });
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service, { attemptId: 0 })).resolves.toMatchObject({
      status: 'saved',
    });
    expect(room.attempts[0].results.has('42')).toBe(true);
    expect(room.attempts[1].results.has('42')).toBe(false);
    expect(room.waitingFor.get('42')).toBe(true);
  });

  it('serializes duplicate submissions in one room', async () => {
    const room = makeRoom();
    let finishSave;
    let notifySaveStarted;
    const saveStarted = new Promise((resolve) => {
      notifySaveStarted = resolve;
    });
    room.save.mockImplementation(() => new Promise((resolve) => {
      finishSave = () => resolve(room);
      notifySaveStarted();
    }));
    const fetchRoom = jest.fn().mockResolvedValue(room);
    const service = createResultSubmissionService({ fetchRoom });

    const first = submit(service);
    await saveStarted;
    const second = submit(service);
    await Promise.resolve();

    expect(fetchRoom).toHaveBeenCalledTimes(1);
    finishSave();

    await expect(first).resolves.toMatchObject({ status: 'saved' });
    await expect(second).resolves.toMatchObject({ status: 'duplicate' });
    expect(fetchRoom).toHaveBeenCalledTimes(2);
    expect(room.save).toHaveBeenCalledTimes(1);
  });

  it('serializes simultaneous submissions from different users in one room', async () => {
    const room = makeRoom();
    let finishFirstSave;
    let notifyFirstSaveStarted;
    const firstSaveStarted = new Promise((resolve) => {
      notifyFirstSaveStarted = resolve;
    });
    room.save
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishFirstSave = () => resolve(room);
        notifyFirstSaveStarted();
      }))
      .mockImplementation(async () => room);
    const fetchRoom = jest.fn().mockResolvedValue(room);
    const service = createResultSubmissionService({ fetchRoom });

    const first = submit(service);
    await firstSaveStarted;
    const second = submit(service, {
      userId: 43,
      submissionId: 'submission-456',
      result: { time: 23456, penalties: {} },
    });
    await Promise.resolve();

    expect(fetchRoom).toHaveBeenCalledTimes(1);
    finishFirstSave();

    await expect(first).resolves.toMatchObject({ status: 'saved' });
    await expect(second).resolves.toMatchObject({ status: 'saved' });
    expect(fetchRoom).toHaveBeenCalledTimes(2);
    expect(room.save).toHaveBeenCalledTimes(2);
    expect(room.attempts[0].results.has('42')).toBe(true);
    expect(room.attempts[0].results.has('43')).toBe(true);
    expect(room.waitingFor.get('42')).toBe(false);
    expect(room.waitingFor.get('43')).toBe(false);
  });

  it('repairs failed room advancement on a duplicate retry without republishing', async () => {
    const room = makeRoom();
    room.doneWithScramble = jest.fn(() => (
      room.attempts.length === 1 && room.waitingFor.get('42') === false
    ));
    const advanceError = new Error('new attempt save failed');
    const advanceRoom = jest.fn()
      .mockRejectedValueOnce(advanceError)
      .mockImplementation(async (currentRoom) => {
        currentRoom.attempts.push({
          _id: 'attempt-1',
          id: 1,
          results: new Map(),
        });
        currentRoom.waitingFor.set('42', true);
        return currentRoom;
      });
    const onSaved = jest.fn();
    const service = createResultSubmissionService({
      advanceRoom,
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service, { onSaved })).rejects.toMatchObject({
      statusCode: 503,
      retryable: true,
      cause: advanceError,
    });
    expect(room.attempts[0].results.get('42')).toMatchObject({
      submissionId: 'submission-123',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    await expect(submit(service, { onSaved })).resolves.toMatchObject({
      status: 'duplicate',
    });
    expect(advanceRoom).toHaveBeenCalledTimes(2);
    expect(room.attempts).toHaveLength(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('does not advance twice when duplicate retries arrive concurrently', async () => {
    const existingResult = {
      time: 12345,
      penalties: {},
      submissionId: 'submission-123',
    };
    const room = makeRoom({ existingResult });
    room.waitingFor.set('42', false);
    room.doneWithScramble = jest.fn(() => room.attempts.length === 1);
    let finishAdvance;
    let notifyAdvanceStarted;
    const advanceStarted = new Promise((resolve) => {
      notifyAdvanceStarted = resolve;
    });
    const advanceRoom = jest.fn(() => new Promise((resolve) => {
      notifyAdvanceStarted();
      finishAdvance = () => {
        room.attempts.push({
          _id: 'attempt-1',
          id: 1,
          results: new Map(),
        });
        resolve(room);
      };
    }));
    const fetchRoom = jest.fn().mockResolvedValue(room);
    const service = createResultSubmissionService({ advanceRoom, fetchRoom });

    const first = submit(service);
    await advanceStarted;
    const second = submit(service);
    await Promise.resolve();

    expect(fetchRoom).toHaveBeenCalledTimes(1);
    finishAdvance();

    await expect(first).resolves.toMatchObject({ status: 'duplicate' });
    await expect(second).resolves.toMatchObject({ status: 'duplicate' });
    expect(fetchRoom).toHaveBeenCalledTimes(2);
    expect(advanceRoom).toHaveBeenCalledTimes(1);
    expect(room.attempts).toHaveLength(2);
  });

  it.each([
    [{ inRoom: false }, 403, false],
    [{ banned: true }, 403, false],
    [{ attempts: 0 }, 400, false],
  ])('rejects invalid room state', async (roomOptions, statusCode, retryable) => {
    const room = makeRoom(roomOptions);
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockResolvedValue(room),
    });

    await expect(submit(service)).rejects.toMatchObject({ statusCode, retryable });
    expect(room.save).not.toHaveBeenCalled();
  });

  it('marks database failures as retryable without exposing their details', async () => {
    const databaseError = new Error('private connection details');
    const service = createResultSubmissionService({
      fetchRoom: jest.fn().mockRejectedValue(databaseError),
    });

    let failure;
    try {
      await submit(service);
    } catch (err) {
      failure = err;
    }

    expect(failure).toBeInstanceOf(ResultSubmissionError);
    expect(failure.toResponse()).toEqual({
      statusCode: 503,
      message: 'Failed to save result',
      retryable: true,
    });
    expect(failure.cause).toBe(databaseError);
  });
});
