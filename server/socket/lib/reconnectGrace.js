const timerKey = (roomId, userId) => `${roomId}:${userId}`;

const DEFAULT_RECONCILIATION_CONCURRENCY = 2;
const DEFAULT_RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_FINALIZATION_RETRIES = 2;
const DEFAULT_FINALIZATION_RETRY_DELAY_MS = 1000;

const createReconnectGrace = ({
  graceMs,
  hasActiveSockets,
  finalizeDeparture,
  listActiveUsers,
  logger,
  reconciliationConcurrency = DEFAULT_RECONCILIATION_CONCURRENCY,
  reconciliationIntervalMs = DEFAULT_RECONCILIATION_INTERVAL_MS,
  maxFinalizationRetries = DEFAULT_MAX_FINALIZATION_RETRIES,
  finalizationRetryDelayMs = DEFAULT_FINALIZATION_RETRY_DELAY_MS,
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

    const finalization = finalizationQueues.get(roomId.toString());
    return finalization
      ? finalization.then(() => true, () => true)
      : Promise.resolve(false);
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

  const wait = (delayMs) => new Promise((resolve) => {
    const timer = setTimer(resolve, delayMs);
    if (timer && timer.unref) {
      timer.unref();
    }
  });

  const finalizeWithRetry = async (departure, requireInactive, retry = 0) => {
    try {
      return await enqueueFinalization(departure, requireInactive);
    } catch (err) {
      if (retry >= maxFinalizationRetries) {
        throw err;
      }

      await wait(finalizationRetryDelayMs * (retry + 1));
      return finalizeWithRetry(departure, requireInactive, retry + 1);
    }
  };

  const finalizeIfInactive = (departure) => finalizeWithRetry(departure, true);
  const finalize = (departure) => finalizeWithRetry(departure, false);

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
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < activeUsers.length) {
        const departure = activeUsers[nextIndex];
        nextIndex += 1;
        await finalizeIfInactive(departure).catch((err) => logger.error(err));
      }
    };
    const workerCount = Math.min(reconciliationConcurrency, activeUsers.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
  };

  const scheduleReconciliation = (delayMs) => {
    const timer = setTimer(async () => {
      await reconcile().catch((err) => logger.error(err));
      scheduleReconciliation(reconciliationIntervalMs);
    }, delayMs);

    if (timer && timer.unref) {
      timer.unref();
    }

    return timer;
  };

  const startReconciliation = () => scheduleReconciliation(graceMs);

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
