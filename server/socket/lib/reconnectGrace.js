const timerKey = (roomId, userId) => `${roomId}:${userId}`;

const createReconnectGrace = ({
  graceMs,
  hasActiveSockets,
  finalizeDeparture,
  listActiveUsers,
  logger,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) => {
  const timers = new Map();
  const finalizationQueues = new Map();

  const cancel = (roomId, userId) => {
    const key = timerKey(roomId, userId);
    const timer = timers.get(key);
    if (timer) {
      clearTimer(timer);
      timers.delete(key);
    }
  };

  const enqueueFinalization = (departure, requireInactive) => {
    const roomKey = departure.roomId.toString();
    const previous = finalizationQueues.get(roomKey) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      if (requireInactive
        && await hasActiveSockets(departure.userId, departure.roomId)) {
        return false;
      }

      return finalizeDeparture(departure);
    });

    finalizationQueues.set(roomKey, current);
    current.finally(() => {
      if (finalizationQueues.get(roomKey) === current) {
        finalizationQueues.delete(roomKey);
      }
    }).catch(() => {});

    return current;
  };

  const finalizeIfInactive = (departure) => enqueueFinalization(departure, true);
  const finalize = (departure) => enqueueFinalization(departure, false);

  const schedule = (departure) => {
    cancel(departure.roomId, departure.userId);

    const key = timerKey(departure.roomId, departure.userId);
    const timer = setTimer(() => {
      timers.delete(key);
      finalizeIfInactive(departure).catch((err) => logger.error(err));
    }, graceMs);

    if (timer && timer.unref) {
      timer.unref();
    }

    timers.set(key, timer);
  };

  const reconcile = async () => {
    const activeUsers = await listActiveUsers();
    await Promise.all(activeUsers.map((departure) => finalizeIfInactive(departure)));
  };

  const startReconciliation = () => {
    const timer = setTimer(() => {
      reconcile().catch((err) => logger.error(err));
    }, graceMs);

    if (timer && timer.unref) {
      timer.unref();
    }

    return timer;
  };

  return {
    cancel,
    finalize,
    reconcile,
    schedule,
    startReconciliation,
  };
};

module.exports = {
  createReconnectGrace,
};
