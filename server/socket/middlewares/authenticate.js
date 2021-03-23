const logger = require('../../logger');
const { User } = require('../../models');
const { encodeUser } = require('../utils');

module.exports = async (socket, next) => {
  const userId = socket.handshake.session.passport
    ? socket.handshake.session.passport.user : null;

  if (!userId) {
    return next();
  }

  socket.userId = userId;

  socket.join(encodeUser(userId));

  try {
    socket.user = await User.findOne({ id: userId });
  } catch (e) {
    logger.error(e, { userId });
  }

  next();
};
