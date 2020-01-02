module.exports = (socket, next) => {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : 'ANON';

  socket.use((packet, next) => {
    next();
  });
  next();
};