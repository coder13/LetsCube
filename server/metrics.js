const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const config = require('./runtimeConfig');
const logger = require('./logger');
const { METRIC_EVENTS, MetricEvent } = require('./models');
const { mirrorMetricEvent } = require('./postgres/dualWrite');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const countRoomSolves = (room) => room.attempts.reduce((total, attempt) => {
  const resultCount = attempt.results instanceof Map
    ? attempt.results.size
    : Object.keys(attempt.results || {}).length;
  return total + resultCount;
}, 0);

const createMetricRecorder = ({
  model = MetricEvent,
  metricsConfig = config.metrics,
  metricLogger = logger,
  metricMirror = mirrorMetricEvent,
  now = () => new Date(),
} = {}) => {
  const enabled = !!metricsConfig.enabled;
  const retentionMs = metricsConfig.retentionDays * MS_PER_DAY;

  const pseudonymize = (kind, value) => {
    if (value === undefined || value === null || !metricsConfig.hashSecret) {
      return undefined;
    }

    return crypto.createHmac('sha256', metricsConfig.hashSecret)
      .update(`${kind}:${value}`)
      .digest('hex');
  };

  const roomProperties = (room) => {
    if (!room) {
      return {};
    }

    return {
      roomId: pseudonymize('room', room._id || room.id),
      roomType: room.type,
      cubeEvent: room.event,
      privateRoom: !!room.password,
    };
  };

  const actorProperties = ({ userId, connectionId }) => ({
    actorId: pseudonymize(userId ? 'user' : 'connection', userId || connectionId),
    actorType: userId ? 'authenticated' : 'anonymous',
  });

  const write = async (event, { ignoreDuplicate = false } = {}) => {
    if (!enabled) {
      return null;
    }

    const occurredAt = now();
    const persistedEvent = {
      ...event,
      eventId: uuidv4(),
      occurredAt,
      expiresAt: new Date(occurredAt.getTime() + retentionMs),
    };
    let created = null;
    try {
      created = await model.create(persistedEvent);
    } catch (err) {
      if (!ignoreDuplicate || err.code !== 11000) {
        metricLogger.error(err);
      }
      if (ignoreDuplicate && err.code === 11000) {
        return null;
      }
    }

    Promise.resolve()
      .then(() => metricMirror(persistedEvent))
      .catch((err) => metricLogger.error(err));
    return created;
  };

  const beginRoomVisit = async ({
    room, userId, connectionId, activeUserCount, replaceActive = false,
  }) => {
    if (!enabled) {
      return null;
    }

    const event = {
      event: METRIC_EVENTS.ROOM_JOINED,
      ...actorProperties({ userId, connectionId }),
      ...roomProperties(room),
      activeUserCount,
      active: true,
    };

    if (replaceActive && event.actorId && event.roomId) {
      try {
        await model.updateMany({
          event: METRIC_EVENTS.ROOM_JOINED,
          actorId: event.actorId,
          roomId: event.roomId,
          active: true,
        }, {
          $set: {
            active: false,
            closedAt: now(),
          },
        });
      } catch (err) {
        metricLogger.error(err);
      }
    }

    // An authenticated user may join through multiple tabs. The partial unique
    // index turns those sockets into one logical room visit.
    const created = await write(event, { ignoreDuplicate: true });
    if (created || !event.actorId || !event.roomId) {
      return created;
    }

    try {
      return await model.findOne({
        event: METRIC_EVENTS.ROOM_JOINED,
        actorId: event.actorId,
        roomId: event.roomId,
        active: true,
      });
    } catch (err) {
      metricLogger.error(err);
      return null;
    }
  };

  const endRoomVisit = async ({
    room, userId, connectionId, leaveReason, activeUserCount,
  }) => {
    if (!enabled) {
      return null;
    }

    const actor = actorProperties({ userId, connectionId });
    const roomData = roomProperties(room);
    const closedAt = now();
    let durationMs;
    let visitFound = false;

    if (actor.actorId && roomData.roomId) {
      try {
        const visit = await model.findOneAndUpdate({
          event: METRIC_EVENTS.ROOM_JOINED,
          actorId: actor.actorId,
          roomId: roomData.roomId,
          active: true,
        }, {
          $set: {
            active: false,
            closedAt,
          },
        }, {
          sort: { occurredAt: -1 },
        });

        if (visit) {
          visitFound = true;
          durationMs = Math.max(0, closedAt.getTime() - visit.occurredAt.getTime());
        }
      } catch (err) {
        metricLogger.error(err);
      }
    }

    // A kick or ban is followed by the affected socket disconnecting. Only the
    // first path that closes the active visit should emit a leave event.
    if (actor.actorId && roomData.roomId && !visitFound) {
      return null;
    }

    return write({
      event: METRIC_EVENTS.ROOM_LEFT,
      ...actor,
      ...roomData,
      leaveReason,
      activeUserCount,
      durationMs,
    });
  };

  return {
    recordAuthFailure: (failureReason) => write({
      event: METRIC_EVENTS.AUTH_FAILED,
      failureReason,
    }),
    recordRoomCreated: ({ room, userId }) => write({
      event: METRIC_EVENTS.ROOM_CREATED,
      ...actorProperties({ userId }),
      ...roomProperties(room),
    }),
    recordRoomJoinFailure: ({
      room, userId, connectionId, failureReason,
    }) => write({
      event: METRIC_EVENTS.ROOM_JOIN_FAILED,
      ...actorProperties({ userId, connectionId }),
      ...roomProperties(room),
      failureReason,
    }),
    recordRoomResult: ({ room, userId }) => write({
      event: METRIC_EVENTS.ROOM_RESULT_SUBMITTED,
      ...actorProperties({ userId }),
      ...roomProperties(room),
      roomSolveCount: countRoomSolves(room),
    }),
    recordSocialOutcome: ({ userId, action, outcome }) => write({
      event: METRIC_EVENTS.SOCIAL_ACTION,
      ...actorProperties({ userId }),
      socialAction: action,
      socialOutcome: outcome,
    }),
    beginRoomVisit,
    endRoomVisit,
    pseudonymize,
  };
};

module.exports = {
  ...createMetricRecorder(),
  countRoomSolves,
  createMetricRecorder,
};
