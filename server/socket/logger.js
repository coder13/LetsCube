module.exports = (socket, next) => {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : 'ANON';

  socket.use((packet, n) => {
    console.log(`[SOCKET] ${socket.id}\t${userId}\t${packet.join('\t')}`);
    n();
  });
  next();
};
