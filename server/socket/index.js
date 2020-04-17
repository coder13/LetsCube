const _ = require('lodash');
const http = require('http');
const bcrypt = require('bcrypt');
const socketIO = require('socket.io');
const expressSocketSession = require('express-socket.io-session');
const logger = require('../logger');
const Protocol = require('../../client/src/lib/protocol.js');
const { User, Room } = require('../models');
const ChatMessage = require('./ChatMessage');

const roomMask = (room) => ({
  ..._.partial(_.pick, _, ['_id', 'name', 'event', 'usersLength', 'private'])(room),
  users: room.private ? undefined : room.users.map((user) => user.displayName),
});

const joinRoomMask = _.partial(_.pick, _, ['_id', 'name', 'event', 'users', 'attempts', 'admin', 'accessCode', 'usersLength', 'private']);

// Keep track of users using multiple sockets.
// Map of user.id -> {room.id: [socket.id]}
const SocketUsers = {};

async function attachUser(socket, next) {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : null;

  if (!userId) {
    return next();
  }

  try {
    const user = await User.findOne({ id: userId });
    if (user) {
      socket.user = user;

      if (!SocketUsers[socket.user.id]) {
        SocketUsers[socket.user.id] = {};
      }
    }
  } catch (e) {
    logger.error(e);
  }
  next();
}

module.exports = ({ app, expressSession }) => {
  const server = http.Server(app);
  const io = socketIO(server);
  app.io = io;

  io.use(expressSocketSession(expressSession, {
    autoSave: true,
  }));

  io.use(attachUser);

  io.use((socket, next) => {
    socket.use(([event, data], n) => {
      logger.info(event, {
        id: socket.id,
        user: socket.user ? {
          id: socket.user.id,
        } : undefined,
        data,
      });

      n();
    });

    next();
  });

  io.sockets.on('connection', (socket) => {
    logger.debug(`socket ${socket.id} connected; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    // give them the list of rooms
    Room.find().then((rooms) => {
      socket.emit(Protocol.UPDATE_ROOMS, rooms.map(roomMask));
    });

    function broadcast(...args) {
      socket.broadcast.to(socket.room.accessCode).emit(...args);
    }

    function broadcastToAllInRoom(accessCode, event, data) {
      io.in(accessCode).emit(event, data);
    }

    function broadcastToEveryone(...args) {
      io.emit(...args);
    }

    function isLoggedIn() {
      if (!socket.user) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: 'Must be logged in',
        });
      }
      return !!socket.user;
    }

    function isInRoom() {
      if (!socket.room) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          message: 'Must be in a room',
        });
      }
      return !!socket.room;
    }

    function checkAdmin() {
      if (!isLoggedIn() || !isInRoom()) {
        return false;
      } if (socket.room.admin.id !== socket.user.id) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: 'Must be admin of room',
        });
        return false;
      }
      return true;
    }

    function sendNewScramble(room) {
      room.newAttempt((attempt) => {
        broadcastToAllInRoom(room.accessCode, Protocol.NEW_ATTEMPT, attempt);
      });
    }

    async function leaveRoom() {
      socket.leave(socket.room.accessCode);

      // only socket on this user id
      if (!SocketUsers[socket.user.id]) {
        logger.error('Reference to users\' socket lookup is undefined for some reason');
        return;
      }

      if (!SocketUsers[socket.user.id][socket.room._id]
        || SocketUsers[socket.user.id][socket.room._id].length === 0) {
        return;
      }

      SocketUsers[socket.user.id][socket.room._id].splice(
        SocketUsers[socket.user.id][socket.room._id].indexOf(socket.id), 1,
      );

      if (SocketUsers[socket.user.id][socket.room._id].length === 0) {
        try {
          const room = await socket.room.dropUser(socket.user, (_room) => {
            broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_ADMIN, _room.admin);
          });

          broadcast(Protocol.USER_LEFT, socket.user.id);
          broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));

          if (room.doneWithScramble()) {
            logger.debug('everyone done, sending new scramble');
            sendNewScramble(room);
          }

          delete SocketUsers[socket.user.id][room._id];
        } catch (e) {
          logger.error(e);
        }
      }

      delete socket.room;
    }

    function joinRoom(room, cb) {
      if (socket.room) {
        return;
      }

      socket.join(room.accessCode, async () => {
        socket.room = room;

        if (!socket.user) {
          socket.emit(Protocol.JOIN, joinRoomMask(room));
          return;
        }

        if (!SocketUsers[socket.user.id][room._id]) {
          SocketUsers[socket.user.id][room._id] = [];
        }

        SocketUsers[socket.user.id][room._id].push(socket.id);

        const r = await room.addUser(socket.user, (_room) => {
          broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_ADMIN, _room.admin);
        });

        if (!r) {
          // Join the socket to the room anyways but don't add them
          socket.emit(Protocol.JOIN, joinRoomMask(room));
          return;
        }

        socket.room = r;
        socket.emit(Protocol.JOIN, joinRoomMask(r));

        if (cb) cb(r);

        broadcast(Protocol.USER_JOIN, socket.user); // tell everyone
        broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(r));
      });
    }

    // Socket wants to join room.
    socket.on(Protocol.JOIN_ROOM, async ({ id, password }) => {
      try {
        const room = await Room.findById(id);
        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            message: `Could not find room with id ${id}`,
          });
          return;
        }

        if (room.private && !room.authenticate(password)) {
          socket.emit(Protocol.ERROR, {
            statusCode: 403,
            event: Protocol.JOIN_ROOM,
            message: 'Invalid password',
          });
          return;
        }

        joinRoom(room);
      } catch (e) {
        logger.error(e);
      }
    });

    // Given ID, fetches room, authenticates, and returns room data.
    socket.on(Protocol.FETCH_ROOM, async (id) => {
      try {
        socket.user = socket.user ? await User.findById(socket.user._id) : undefined;
        const room = await Room.findById(id);

        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            event: Protocol.FETCH_ROOM,
            message: `Could not find room with id ${id}`,
          });
        } else if (room.private) {
          socket.emit(Protocol.UPDATE_ROOM, roomMask(room));
        } else {
          joinRoom(room);
        }
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.CREATE_ROOM, async (options) => {
      if (!isLoggedIn()) {
        return;
      }

      const newRoom = new Room({
        name: options.name,
      });

      if (options.password) {
        newRoom.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
      }

      const room = await newRoom.save();
      io.emit(Protocol.ROOM_CREATED, room);
      await joinRoom(room, (r) => {
        sendNewScramble(r);
      });
      socket.emit(Protocol.FORCE_JOIN, room);
    });

    /* Admin Actions */
    socket.on(Protocol.DELETE_ROOM, async (id) => {
      if (!isInRoom()) {
        return;
      }

      const room = await Room.findById(socket.room._id);
      if (!room) {
        return;
      }

      socket.room = room;

      if (!checkAdmin()) {
        return;
      }


      Room.deleteOne({ _id: id }).then((res) => {
        if (res.deletedCount > 0) {
          socket.room = undefined;
          broadcastToEveryone(Protocol.ROOM_DELETED, id);
        } else if (res.deletedCount > 1) {
          logger.error(168, 'big problemo');
        }
      });
    });

    socket.on(Protocol.SUBMIT_RESULT, async (result) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      try {
        const room = await Room.findById(socket.room._id);
        if (!room) {
          return;
        }

        if (!room.attempts[result.id]) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SUBMIT_RESULT,
            message: 'Invalid ID for attempt submission',
          });
          return;
        }

        room.attempts[result.id].results.set(socket.user.id.toString(), result.result);
        const r = await room.save();

        broadcastToAllInRoom(r.accessCode, Protocol.NEW_RESULT, {
          id: result.id,
          userId: socket.user.id,
          result: result.result,
        });

        if (r.doneWithScramble()) {
          logger.debug('everyone done, sending new scramble');
          sendNewScramble(r);
        }
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.REQUEST_SCRAMBLE, async () => {
      try {
        const room = await Room.findById(socket.room._id);
        if (!room) {
          return;
        }

        socket.room = room;
        if (!checkAdmin()) {
          return;
        }

        sendNewScramble(room);
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.CHANGE_EVENT, async (event) => {
      try {
        const room = await Room.findById(socket.room._id);
        if (!room) {
          return;
        }

        socket.room = room;
        if (!checkAdmin()) {
          return;
        }

        room.changeEvent(event).then((r) => {
          broadcastToAllInRoom(r.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
        });
      } catch (e) {
        logger.error(e);
      }
    });

    // Simplest event here. Just echo the message to everyone else.
    socket.on(Protocol.MESSAGE, (message) => {
      if (!isInRoom()) {
        return;
      }

      if (!socket.user) {
        return;
      }

      broadcastToAllInRoom(socket.room.accessCode, Protocol.MESSAGE,
        new ChatMessage(message.text, socket.user.id));
    });

    // Simplest event here. Just echo the message to everyone else.
    socket.on(Protocol.UPDATE_STATUS, (status) => {
      if (!isInRoom()) {
        return;
      }

      if (!socket.user) {
        return;
      }

      broadcast(Protocol.UPDATE_STATUS, status);
    });

    socket.on(Protocol.DISCONNECT, async () => {
      logger.debug(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`);

      if (!socket.user || !socket.room) {
        return;
      }

      try {
        const room = await Room.findById(socket.room._id);
        if (!room) {
          return;
        }

        await leaveRoom();
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.LEAVE_ROOM, async () => {
      try {
        if (isLoggedIn() && isInRoom()) {
          const room = await Room.findById(socket.room._id);
          if (!room) {
            return;
          }

          socket.room = room;
          leaveRoom();
        }
      } catch (e) {
        logger.error(e);
      }
    });
  });

  return server;
};
