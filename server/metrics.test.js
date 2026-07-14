/** @jest-environment node */
/* eslint-env jest */

const { METRIC_EVENTS } = require('./models/metricEvent');
const { countRoomSolves, createMetricRecorder } = require('./metrics');

const room = {
  _id: 'room-123',
  type: 'normal',
  event: '333',
  password: 'hashed-password',
  attempts: [
    { results: new Map([['1', {}], ['2', {}]]) },
    { results: new Map([['1', {}]]) },
  ],
};

const createRecorder = (overrides = {}) => {
  const model = {
    create: jest.fn(async (event) => event),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  };
  const metricLogger = { error: jest.fn() };
  const metricMirror = jest.fn();
  const now = jest.fn(() => new Date('2026-07-09T12:00:00.000Z'));
  const recorder = createMetricRecorder({
    model,
    metricLogger,
    metricMirror,
    now,
    metricsConfig: {
      enabled: true,
      hashSecret: 'metrics-test-secret',
      retentionDays: 90,
    },
    ...overrides,
  });

  return {
    model, metricLogger, metricMirror, now, recorder,
  };
};

describe('metrics recorder', () => {
  it('pseudonymizes users and rooms with separated identifiers', () => {
    const { recorder } = createRecorder();

    const userId = recorder.pseudonymize('user', 123);
    const roomId = recorder.pseudonymize('room', 123);

    expect(userId).toHaveLength(64);
    expect(userId).not.toBe('123');
    expect(userId).not.toBe(roomId);
    expect(recorder.pseudonymize('user', 123)).toBe(userId);
  });

  it('records one active room visit without raw identifiers or room names', async () => {
    const { model, recorder } = createRecorder();

    await recorder.beginRoomVisit({
      room,
      userId: 123,
      connectionId: 'socket-secret',
      activeUserCount: 4,
    });

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      event: METRIC_EVENTS.ROOM_JOINED,
      actorType: 'authenticated',
      activeUserCount: 4,
      roomType: 'normal',
      cubeEvent: '333',
      privateRoom: true,
      active: true,
      occurredAt: new Date('2026-07-09T12:00:00.000Z'),
      expiresAt: new Date('2026-10-07T12:00:00.000Z'),
    }));

    const event = model.create.mock.calls[0][0];
    expect(event.actorId).not.toContain('123');
    expect(event.roomId).not.toContain('room-123');
    expect(event).not.toHaveProperty('connectionId');
    expect(event).not.toHaveProperty('name');
    expect(event).not.toHaveProperty('password');
  });

  it('closes a stale visit when the room state says this is a new join', async () => {
    const { model, recorder } = createRecorder();

    await recorder.beginRoomVisit({
      room,
      userId: 123,
      activeUserCount: 4,
      replaceActive: true,
    });

    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        event: METRIC_EVENTS.ROOM_JOINED,
        active: true,
      }),
      { $set: expect.objectContaining({ active: false }) },
    );
    expect(model.create).toHaveBeenCalledTimes(1);
  });

  it('records a leave with the duration of the open visit', async () => {
    const joinedAt = new Date('2026-07-09T11:55:00.000Z');
    const { model, recorder } = createRecorder();
    model.findOneAndUpdate.mockResolvedValue({ occurredAt: joinedAt });

    await recorder.endRoomVisit({
      room,
      userId: 123,
      leaveReason: 'explicit',
      activeUserCount: 3,
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        event: METRIC_EVENTS.ROOM_JOINED,
        active: true,
      }),
      { $set: expect.objectContaining({ active: false }) },
      { sort: { occurredAt: -1 } },
    );
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      event: METRIC_EVENTS.ROOM_LEFT,
      leaveReason: 'explicit',
      durationMs: 5 * 60 * 1000,
      activeUserCount: 3,
    }));
  });

  it('does not duplicate a leave after a visit has already closed', async () => {
    const { model, recorder } = createRecorder();
    model.findOneAndUpdate.mockResolvedValue(null);

    await expect(recorder.endRoomVisit({
      room,
      userId: 123,
      leaveReason: 'disconnect',
      activeUserCount: 3,
    })).resolves.toBeNull();

    expect(model.create).not.toHaveBeenCalled();
  });

  it('records join and authentication failure categories only', async () => {
    const { model, recorder } = createRecorder();

    await recorder.recordRoomJoinFailure({
      room,
      userId: 123,
      failureReason: 'invalid_password',
    });
    await recorder.recordAuthFailure('missing_code');

    expect(model.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      event: METRIC_EVENTS.ROOM_JOIN_FAILED,
      failureReason: 'invalid_password',
    }));
    expect(model.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      event: METRIC_EVENTS.AUTH_FAILED,
      failureReason: 'missing_code',
    }));
  });

  it('counts unique result slots without storing solve times', async () => {
    const { model, recorder } = createRecorder();

    expect(countRoomSolves(room)).toBe(3);
    await recorder.recordRoomResult({ room, userId: 123 });

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      event: METRIC_EVENTS.ROOM_RESULT_SUBMITTED,
      roomSolveCount: 3,
    }));
    expect(model.create.mock.calls[0][0]).not.toHaveProperty('attempts');
  });

  it('does not disrupt application behavior when metrics storage fails', async () => {
    const { model, metricLogger, recorder } = createRecorder();
    const error = new Error('metrics database unavailable');
    model.create.mockRejectedValue(error);

    await expect(recorder.recordAuthFailure('no_user')).resolves.toBeNull();
    expect(metricLogger.error).toHaveBeenCalledWith(error);
  });

  it('records social outcomes without a target or graph edge', async () => {
    const { model, recorder } = createRecorder();

    await recorder.recordSocialOutcome({
      action: 'accept',
      outcome: 'request_accepted',
      userId: 123,
    });

    const event = model.create.mock.calls[0][0];
    expect(event).toEqual(expect.objectContaining({
      actorType: 'authenticated',
      event: METRIC_EVENTS.SOCIAL_ACTION,
      socialAction: 'accept',
      socialOutcome: 'request_accepted',
    }));
    expect(event.actorId).not.toContain('123');
    expect(event).not.toHaveProperty('targetId');
    expect(event).not.toHaveProperty('pairKey');
    expect(event).not.toHaveProperty('relationshipId');
  });
});
