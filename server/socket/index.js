const _ = require('lodash');
const http = require('http');
const bcrypt = require('bcrypt');
const uuid = require('uuid/v4');
const Protocol = require('../../app/lib/protocol.js');
const socketLogger = require('./logger');
const expressSocketSession = require('express-socket.io-session');
const { User, Room } = require('../models');

const roomMask = _.partial(_.pick,  _, ['_id', 'name', 'event', 'usersLength', 'private']);
const publicRoomMask = _.partial(_.pick,  _, ['_id', 'name', 'event', 'users', 'accessCode', 'usersLength', 'private']);
const joinRoomMask = _.partial(_.pick,  _, ['_id', 'name', 'event', 'users', 'attempts', 'admin', 'accessCode', 'usersLength', 'private']);

// Keep track of users using multiple sockets.
// Map of user.id -> [socket.id]
const SocketUsers = {};

class ChatMessage {
  constructor(message, userId) {
    this.id = uuid();
    this.timestamp = Date.now();
    this.text = message;
    this.userId = userId;
  }
}

async function attachUser (socket, next) {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : null;

  if (!userId) {
    return next();
  }

  try {
    const user = await User.findOne({id: userId})
    if (user) {
      socket.user = user;

      if (!SocketUsers[socket.user.id]) {
        SocketUsers[socket.user.id] = [];
      }

      SocketUsers[socket.user.id].push(socket.id);
    }

    next();
  } catch (e) {
    console.error(e);
  }
}

module.exports = function ({app, expressSession}) {
  const server = http.Server(app);
  const io = app.io = require('socket.io')(server);

  io.use(expressSocketSession(expressSession, {
    autoSave: true
  }));
  
  io.use(attachUser);
  io.use(socketLogger);

  io.sockets.on('connection', function (socket) {
    console.log(`socket ${socket.id} connected; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);
    
    // give them the list of rooms
    Room.find().then(rooms => {
      socket.emit(Protocol.UPDATE_ROOMS, rooms.map(roomMask));
    });
    
    function joinRoom(room) {
      socket.join(room.accessCode, async () => {
        socket.room = room;
        if (!socket.user) {
          return socket.emit(Protocol.JOIN, joinRoomMask(room)); // still give them the data
        }

        const r = await room.addUser(socket.user);
        if (!r) {
          // still give them the data, even if they are already in the room
          socket.emit(Protocol.JOIN, joinRoomMask(room));
          return;
        }

        socket.emit(Protocol.JOIN, joinRoomMask(r)); // tell the user they're cool and give them the info
        broadcast(Protocol.USER_JOIN, socket.user); // tell everyone
        broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(r));

        await r.updateAdminIfNeeded(({ admin }) => {
          broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_ADMIN, admin);
        });

        if (r.doneWithScramble()) {
          console.log(104, 'everyone done, sending new scramble');
          sendNewScramble(r);
        }
      });
    }

    // Socket wants to join room.
    socket.on(Protocol.JOIN_ROOM, async ({id, password}) => {
      try {
        socket.user = await User.findById(socket.user._id);
        const room = await Room.findById(id);
        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            message: `Could not find room with id ${id}`
          });
          return;
        }

        if (room.private && !room.authenticate(password)) {
          socket.emit(Protocol.ERROR, {
            statusCode: 403,
            event: Protocol.JOIN_ROOM,
            message: `Invalid password`
          });
          return;
        }

        joinRoom(room);
      } catch (e) {
        console.error(e);
      }
    });

    // Given ID, fetches room, authenticates, and returns room data.
    socket.on(Protocol.FETCH_ROOM, async (id) => {
      try {
        socket.user = await User.findById(socket.user._id);
        const room = await Room.findById(id);

        if (!room) {
          socket.emit(Protocol.ERROR, {
            statusCode: 404,
            event: Protocol.FETCH_ROOM,
            message: `Could not find room with id ${id}`
          });
        } else if (room.private) {
          socket.emit(Protocol.UPDATE_ROOM, roomMask(room));
        } else {
          joinRoom(room);
        }
      } catch (e) {
        console.error(e);
      }
    });

    socket.on(Protocol.CREATE_ROOM, async (options) => {
      if (!isLoggedIn()) {
        return;
      }

      socket.user = await User.findById(socket.user._id);
      const newRoom = new Room({
        name: options.name
      });

      if (options.password) {
        newRoom.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
      }

      const room = await newRoom.save();
      io.emit(Protocol.ROOM_CREATED, room);
      joinRoom(room);
      socket.emit(Protocol.FORCE_JOIN, room);
    });

    /* Admin Actions */
    socket.on(Protocol.DELETE_ROOM, async (id) => {
      const room = await Room.findById(socket.room._id);
      if (!room) {
        return;
      }

      socket.room = room;

      if (!checkAdmin()) {
        return;
      }

      Room.deleteOne({_id: id}).then((res) => {
        if (res.deletedCount > 0) {
          socket.room = undefined;
          broadcastToEveryone(Protocol.ROOM_DELETED, id);
        } else if (res.deletedCount > 1) {
          console.error(168, 'big problemo');
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
          console.log(123, 'everyone done, sending new scramble');
          sendNewScramble(r);
        }
      } catch (e) {
        console.error(e);
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
        console.error(e);
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
        console.error(e);
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

      broadcastToAllInRoom(socket.room.accessCode, Protocol.MESSAGE, new ChatMessage(message.text, socket.user.id));
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

    socket.on(Protocol.DISCONNECT, () => {
      console.log(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`);

      if (isLoggedIn() && isInRoom()) {
        leaveRoom();
      }

      if (socket.user && SocketUsers[socket.user.id]) {
        SocketUsers[socket.user.id].splice(SocketUsers[socket.user.id].indexOf(socket.id));
        if (!SocketUsers[socket.user.id].length) {
          delete SocketUsers[socket.user.id]; // Garbage collection
        }
      }
    });

    socket.on(Protocol.LEAVE_ROOM, () => {
      if (isLoggedIn() && isInRoom()) {
        leaveRoom.call(this);
      }
    });

    function checkAdmin() {
      if (!isLoggedIn() || !isInRoom()) {
        return false;        
      } else if (socket.room.admin.id !== socket.user.id) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: 'Must be admin of room',
        });
        return false;
      }
      return true;
    }

    function isLoggedIn() {
      if (!socket.user) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: `Must be logged in`,
        });
      }
      return !!socket.user;
    }

    function isInRoom() {
      if (!socket.room) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          message: `Must be in a room`,
        });
      }
      return !!socket.room;
    }

    async function leaveRoom () {
      socket.leave(socket.room.accessCode);
      
      // only socket on this user id
      if (!SocketUsers[socket.user.id]) {
        console.log(317, socket.user.id, Object.keys(SocketUsers));
        console.error('Reference to users\' socket lookup is undefined for some reason');
      } else if (SocketUsers[socket.user.id].length === 1) {
        try {
          const room = await socket.room.dropUser(socket.user);

          broadcast(Protocol.USER_LEFT, socket.user.id);
          broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));

          room.updateAdminIfNeeded(({ admin, accessCode }) => {
            broadcastToAllInRoom(accessCode, Protocol.UPDATE_ADMIN, admin);
          });

          if (room.doneWithScramble()) {
            console.log(196, 'everyone done, sending new scramble');
            sendNewScramble(room);
          }

          socket.room = undefined;
        } catch (e) {
          console.error(e);
        }
      }
    }

    function sendNewScramble (room) {
      room.newAttempt(attempt => {
        broadcastToAllInRoom(room.accessCode, Protocol.NEW_ATTEMPT, attempt);
      });
    }

    function broadcast () {
      socket.broadcast.to(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToAllInRoom (accessCode, event, data) {
      io.in(accessCode).emit(event, data);
    }

    function broadcastToEveryone () {
      io.emit(...arguments);
    }
  });

  return server;
}