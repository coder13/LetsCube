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

  socket.userId = userId;

  if (!SocketUsers[socket.userId]) {
    SocketUsers[socket.userId] = {};
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
        userId: socket.userId,
        roomId: socket.roomId,
        data,
      });

      n();
    });

    next();
  });

  io.use((socket, next) => {
    socket.use(async (packet, n) => {
      if (socket.userId) {
        try {
          socket.user = await User.findOne({ id: socket.userId });
        } catch (e) {
          logger.error(e, { userId: socket.userId });
        }
      }

      if (socket.roomId) {
        try {
          socket.room = await Room.findById({ _id: socket.roomId });
        } catch (e) {
          logger.error(e, { userId: socket.userId });
        }
      }

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
      delete socket.roomId;
    }

    function joinRoom(room, cb) {
      if (socket.room) {
        logger.debug('Socket is already in room', { roomId: socket.room._id });
        return;
      }

      socket.join(room.accessCode, async () => {
        socket.roomId = room._id;

        if (!socket.user) {
          logger.debug('Socket is not authenticated but joining anyways', { roomId: room._id, userId: socket.userId });
          socket.emit(Protocol.JOIN, joinRoomMask(room));
          return;
        }

        if (!SocketUsers[socket.user.id][room._id]) {
          SocketUsers[socket.user.id][room._id] = [];
        }

        SocketUsers[socket.user.id][room._id].push(socket.id);

        const r = await room.addUser(socket.user, (_room) => {
          broadcastToAllInRoom(_room.accessCode, Protocol.UPDATE_ADMIN, _room.admin);
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
      if (!socket.user || !socket.roomId) {
        return;
      }

      try {
        if (!socket.room.attempts[result.id]) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SUBMIT_RESULT,
            message: 'Invalid ID for attempt submission',
          });
          return;
        }

        // NOTE: when setting a map in mongoose that the keys are strings
        socket.room.attempts[result.id].results.set(socket.user.id.toString(), result.result);

        const r = await socket.room.save();

        broadcastToAllInRoom(r.accessCode, Protocol.NEW_RESULT, {
          ...result,
          userId: socket.user.id,
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
      if (!checkAdmin()) {
        return;
      }

      sendNewScramble(socket.room);
    });

    socket.on(Protocol.CHANGE_EVENT, async (event) => {
      if (!checkAdmin()) {
        return;
      }

      socket.room.changeEvent(event).then((r) => {
        broadcastToAllInRoom(r.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(socket.room));
      }).catch(logger.error);
    });

    // Simplest event here. Just echo the message to everyone else.
    socket.on(Protocol.MESSAGE, (message) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      broadcastToAllInRoom(socket.room.accessCode, Protocol.MESSAGE,
        new ChatMessage(message.text, socket.user.id));
    });

    // Simplest event here. Just echo the message to everyone else.
    socket.on(Protocol.UPDATE_STATUS, (status) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      broadcast(Protocol.UPDATE_STATUS, status);
    });

    socket.on(Protocol.DISCONNECT, () => {
      logger.debug(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`);

      if (!socket.user || !socket.room) {
        return;
      }

      leaveRoom();
    });

    socket.on(Protocol.LEAVE_ROOM, async () => {
      if (!isLoggedIn() && !isInRoom()) {
        return;
      }

      leaveRoom();
    });
  });

  return server;
};
