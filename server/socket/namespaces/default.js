const logger = require('../../logger');
const Protocol = require('../../../client/src/lib/protocol');

module.exports = (io, middlewares) => {
  const ns = io.of('/');

  middlewares.forEach((middleware) => {
    ns.use(middleware);
  });

  async function updateUsersOnline() {
    try {
      // Since every user get's their own room, count all user rooms.
      const sockets = [...await ns.adapter.allRooms([])].filter((room) => room.indexOf('user/') > -1);
      logger.debug(`Users online: ${sockets.length}`);
      ns.emit(Protocol.UPDATE_USER_COUNT, sockets.length);
    } catch (e) {
      logger.error(e);
    }
  }

  ns.on('connection', (socket) => {
    logger.info(`socket ${socket.id} connected to default; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    updateUsersOnline();

    socket.on(Protocol.DISCONNECT, () => {
      logger.info(`socket ${socket.id} disconnected from default;`);
      updateUsersOnline();
    });
  });
};
