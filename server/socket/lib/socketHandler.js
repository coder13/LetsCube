const createSafeSocketHandler = (socket, logger, errorEvent) => (event, handler) => {
  socket.on(event, (...args) => {
    Promise.resolve()
      .then(() => handler(...args))
      .catch((err) => {
        logger.error(err);

        const response = {
          statusCode: 500,
          event,
          message: 'Socket event failed',
        };
        const acknowledgment = args[args.length - 1];

        if (typeof acknowledgment === 'function') {
          acknowledgment(response);
        } else if (socket.connected) {
          socket.emit(errorEvent, response);
        }
      });
  });
};

const optionalAcknowledgment = (acknowledgment) => (
  typeof acknowledgment === 'function' ? acknowledgment : () => {}
);

module.exports = {
  createSafeSocketHandler,
  optionalAcknowledgment,
};
