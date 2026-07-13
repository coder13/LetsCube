const logger = require('../../logger');

const redactPasswords = (value) => {
  if (Array.isArray(value)) {
    return value.map(redactPasswords);
  }

  if (!value || typeof value !== 'object'
    || Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }

  return Object.entries(value).reduce((redacted, [key, entry]) => ({
    ...redacted,
    [key]: /password/i.test(key) ? '[REDACTED]' : redactPasswords(entry),
  }), {});
};

module.exports = (socket, next) => {
  socket.onAny((event, data) => {
    logger.info(event, {
      id: socket.id,
      userId: socket.userId,
      roomId: socket.roomId,
      data: redactPasswords(data),
    });
  });

  socket.on('error', (err) => {
    logger.error(err);
  });

  next();
};

module.exports.redactPasswords = redactPasswords;
