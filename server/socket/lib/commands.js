const Protocol = require('../../../client/src/lib/protocol');
const ChatMessage = require('./ChatMessage');

const Commands = {
  ping: (ns, user, room, args, reply) => {
    reply(new ChatMessage('Pong!', -2));
  },
  users: (ns, user, room, args, reply) => {
    const users = room.users.map((u) => u.displayName);
    reply(new ChatMessage(`${users.length} users: [${users.join(', ')}]`, -2));
  },
  io_allRooms: (ns, user, room, args, reply) => {
    if (!user || +user.id !== 8184) {
      return;
    }

    ns().adapter.allRooms().then((rooms) => {
      reply(new ChatMessage(`${Array.from(rooms).join(',\n')}`, -2));
    });
  },
  io_sockets_in_room: (ns, user, room, args, reply) => {
    if (!user || +user.id !== 8184) {
      return;
    }

    ns().adapter.sockets(new Set([room.accessCode])).then((sockets) => {
      reply(new ChatMessage(`${sockets.size} sockets: ${Array.from(sockets).join(', ')}`, -2));
    });
  },
};

module.exports.parseCommand = (ns, socket, text) => {
  const line = text.substring(1);
  const pieces = line.split(' ');
  const command = pieces[0];
  const args = pieces.slice(1);

  if (Commands[command]) {
    Commands[command](ns, socket.user, socket.room, args, (chat) => {
      socket.emit(Protocol.MESSAGE, chat);
    });
  } else {
    socket.emit(Protocol.MESSAGE, new ChatMessage('Invalid command!', -2));
  }
};
