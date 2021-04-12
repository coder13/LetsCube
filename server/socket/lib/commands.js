const Protocol = require('../../../client/src/lib/protocol');
const ChatMessage = require('./ChatMessage');

const Commands = {
  ping: () => new ChatMessage('Pong!', -2),
  users: (user, room) => {
    const users = room.users.map((u) => u.displayName);
    return new ChatMessage(`${users.length} users: [${users.join(', ')}]`, -2);
  },
};

module.exports.parseCommand = (socket, text) => {
  const line = text.substring(1);
  const pieces = line.split(' ');
  const command = pieces[0];
  const args = pieces.slice(1);

  if (Commands[command]) {
    socket.emit(Protocol.MESSAGE, Commands[command](socket.user, socket.room, args));
  } else {
    socket.emit(Protocol.MESSAGE, new ChatMessage('Invalid command!', -2));
  }
};
