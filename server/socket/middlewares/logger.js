const logger = require('../../logger');

module.exports = (socket, next) => {
  socket.onAny((event, data) => {
    logger.info(event, {
      id: socket.id,
      userId: socket.userId,
      roomId: socket.roomId,
      data,
    });
  });

  next();
};
