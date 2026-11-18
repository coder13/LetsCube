const registerGracefulShutdown = ({
  name,
  close,
  logger,
  timeoutMs = 25000,
  processRef = process,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) => {
  let shutdownPromise;

  const shutDown = (signal) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    logger.info(`[${name}] Shutting down`, { signal });
    shutdownPromise = new Promise((resolve) => {
      const timeout = setTimer(() => {
        logger.error(`[${name}] Graceful shutdown timed out`);
        processRef.exit(1);
        resolve(false);
      }, timeoutMs);

      Promise.resolve()
        .then(close)
        .then(() => {
          clearTimer(timeout);
          processRef.exit(0);
          resolve(true);
        })
        .catch((err) => {
          clearTimer(timeout);
          logger.error(err);
          processRef.exit(1);
          resolve(false);
        });
    });

    return shutdownPromise;
  };

  processRef.once('SIGTERM', () => shutDown('SIGTERM'));
  processRef.once('SIGINT', () => shutDown('SIGINT'));

  return shutDown;
};

module.exports = { registerGracefulShutdown };
