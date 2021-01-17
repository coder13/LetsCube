const _ = require('lodash');
const http = require('http');
const bcrypt = require('bcrypt');
const config = require('getconfig');
const socketIO = require('socket.io');
const redis = require('socket.io-redis');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const expressSocketSession = require('express-socket.io-session');
const { connect } = require('../database');
const logger = require('../logger');
const Protocol = require('../../client/src/lib/protocol');
const { User, Room } = require('../models');
const ChatMessage = require('./ChatMessage');

const publicRoomKeys = ['_id', 'name', 'event', 'usersLength', 'private', 'type', 'admin', 'requireRevealedIdentity', 'startTime', 'started', 'twitchChannel'];
const privateRoomKeys = [...publicRoomKeys, 'users', 'competing', 'waitingFor', 'banned', 'attempts', 'admin', 'accessCode', 'inRoom', 'registered', 'nextSolveAt'];

// Data for people not in room
const roomMask = (room) => ({
  ..._.partial(_.pick, _, publicRoomKeys)(room),
  users: room.private ? undefined : room.usersInRoom.map((user) => user.displayName),
  registeredUsers: room.users.filter((user) => room.registered.get(user.id.toString())).length,
});

// Data for people in room
const joinRoomMask = _.partial(_.pick, _, privateRoomKeys);

const fetchRoom = async (id) => {
  if (id) {
    try {
      return await Room.findById({ _id: id });
    } catch (e) {
      logger.error(e, { roomId: id });
    }
  }
};

const getRooms = (userId) => Room.find()
  .then((rooms) => rooms.filter((room) => (
    userId ? !room.banned.get(userId.toString()) : true
  )).map(roomMask));

const roomTimerObj = {};

const encodeUser = (userId) => `user/${userId}`;
const encodeUserRoom = (userId, roomId) => `user-room/${userId}-${roomId}`;

const init = async () => {
  const server = http.createServer();
  const io = socketIO(server);

  const mongoose = await connect();

  const sessionOptions = {
    secret: config.auth.secret,
    saveUninitialized: false, // don't create session until something stored
    resave: false, // don't save session if unmodified,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'prod',
      sameSite: 'strict',
    },
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
    }),
  };

  io.adapter(redis({
    host: 'localhost',
    port: 6379,
  }));

  io.use(expressSocketSession(session(sessionOptions), {
    autoSave: true,
  }));

  async function attachUser(socket, next) {
    const userId = socket.handshake.session.passport
      ? socket.handshake.session.passport.user : null;

    if (!userId) {
      return next();
    }

    socket.userId = userId;

    socket.join(encodeUser(userId), (err) => {
      if (err) {
        logger.error(err);
      }
    });

    try {
      socket.user = await User.findOne({ id: userId });
    } catch (e) {
      logger.error(e, { userId });
    }

    next();
  }

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
        socket.room = await fetchRoom(socket.roomId);
      }

      n();
    });
    next();
  });

  function broadcastToEveryone(...args) {
    io.emit(...args);
  }

  function broadcastToAllInRoom(accessCode, event, data) {
    io.in(accessCode).emit(event, data);
  }

  function sendNewScramble(room) {
    return room.newAttempt().then((r) => {
      logger.debug('Sending new scramble to room', { roomId: room.id });
      broadcastToAllInRoom(room.accessCode, Protocol.NEW_ATTEMPT, {
        waitingFor: r.waitingFor,
        attempt: r.attempts[r.attempts.length - 1],
      });

      return r;
    }).catch((err) => {
      logger.error(err);
    });
  }

  const interval = 60 * 1000; // 30 seconds

  function startTimer(room) {
    if (!room) {
      logger.error('Attempting to start undefined room');
      return;
    }

    const newSolve = () => {
      Room.findById(room._id).then(async (r) => {
        if (!r) {
          return;
        }

        const nextSolveAt = new Date(Date.now() + interval);
        logger.debug('nextSolveAt', { nextSolveAt });
        await sendNewScramble(r);
        r.nextSolveAt = nextSolveAt;
        await r.save();
        broadcastToAllInRoom(room.accessCode, Protocol.NEXT_SOLVE_AT, nextSolveAt);
      });
    };

    roomTimerObj[room._id] = setInterval(() => {
      newSolve();
    }, interval);

    const nextSolveAt = new Date(Date.now() + interval);
    logger.info('Starting timer for room; first solve at: ', { roomId: room._id, nextSolveAt });
    broadcastToAllInRoom(room.accessCode, Protocol.NEXT_SOLVE_AT, nextSolveAt);
    room.nextSolveAt = nextSolveAt;
    room.save();
  }

  function awaitRoomStart(room) {
    const time = new Date(room.startTime).getTime() - Date.now();
    logger.debug('Starting countdown for room', {
      roomId: room._id,
      milliseconds: time,
    });

    setTimeout(() => {
      Room.findById(room._id).then((r) => {
        r.start().then((rr) => {
          broadcastToAllInRoom(rr.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(rr));
          startTimer(rr);
        });
      });
    }, time);
  }

  function pauseTimer(room) {
    clearInterval(roomTimerObj[room._id]);
  }

  Room.find({ type: 'grand_prix' })
    .then((rooms) => {
      rooms.forEach(async (room) => {
        if (room.startTime && Date.now() < new Date(room.startTime).getTime()) {
          awaitRoomStart(room);
        } else {
          startTimer(room);
        }
      });
    });

  function updateUsersOnline() {
    io.of('/').adapter.clients((err, clients) => {
      logger.debug(`Users online: ${clients.length}`);
      broadcastToEveryone(Protocol.UPDATE_USER_COUNT, clients.length);
    });
  }

  io.sockets.on('connection', (socket) => {
    logger.debug(`socket ${socket.id} connected; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    getRooms(socket.userId)
      .then((rooms) => {
        socket.emit(Protocol.UPDATE_ROOMS, rooms);
      });

    updateUsersOnline();

    function broadcast(...args) {
      socket.broadcast.to(socket.room.accessCode).emit(...args);
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

    // Only deals with removing authenticated users from a room
    async function leaveRoom() {
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
      } catch (e) {
        logger.error(e);
      }
    }

    function joinRoom(room, cb, spectating) {
      if (socket.rooms[room.accessCode]) {
        logger.debug('Socket is already in room', { roomId: socket.room._id });
        return cb({
          statusCode: 400,
          message: 'Socket is already in room',
        });
      }

      socket.join(room.accessCode, async () => {
        socket.roomId = room._id;

        if (!socket.user) {
          logger.debug('Socket is not authenticated but joining anyways', { roomId: room._id, userId: socket.userId });
          return cb(null, joinRoomMask(room));
        }

        socket.join(encodeUserRoom(socket.userId, room._id));

        const r = await room.addUser(socket.user, spectating, (_room) => {
          broadcastToAllInRoom(_room.accessCode, Protocol.UPDATE_ADMIN, _room.admin);
        });

        if (!r) {
          // Join the socket to the room anyways but don't add them
          return cb(null, joinRoomMask(room));
        }

        socket.room = r;
        socket.emit(Protocol.JOIN, joinRoomMask(r));
        cb(null, joinRoomMask(r));

        broadcast(Protocol.USER_JOIN, socket.user); // tell everyone
        broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(r));

        if (room.doneWithScramble()) {
          logger.debug('everyone done, sending new scramble');
          sendNewScramble(room);
        }
      });
    }

    // Socket wants to join room.
    socket.on(Protocol.JOIN_ROOM, async ({ id, spectating, password }, cb) => {
      try {
        const room = await Room.findById(id);
        if (!room) {
          return cb({
            statusCode: 404,
            message: `Could not find room with id ${id}`,
          });
        }

        if (room.private && !password) {
          return cb({
            statusCode: 403,
            message: 'Room requires password to join',
          }, roomMask(room));
        }

        if (room.private && !room.authenticate(password)) {
          return cb({
            statusCode: 403,
            message: 'Invalid password',
          }, roomMask(room));
        }

        if (room.banned.get(socket.userId.toString())) {
          logger.debug(`Banned user ${socket.user.id} is trying to join room ${room._id}`);
          return cb({
            statusCode: 401,
            message: 'Banned',
            banned: true,
          }, roomMask(room));
        }

        if (room.requireRevealedIdentity && !socket.user.showWCAID) {
          return cb({
            statusCode: 403,
            message: 'Must be showing WCA Identity to join room.',
          }, roomMask(room));
        }

        joinRoom(room, cb, spectating);
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.CREATE_ROOM, async (options, cb) => {
      if (!isLoggedIn()) {
        return cb({
          statusCode: 401,
          message: 'Must be logged in to create a room',
        });
      }

      const newRoom = new Room({
        name: options.name,
        type: options.type,
        requireRevealedIdentity: options.requireRevealedIdentity,
        startTime: options.startTime ? new Date(options.startTime) : null,
        twitchChannel: socket.userId === 6784 || socket.userId === 8184
          ? options.twitchChannel
          : undefined,
        admin: socket.user,
      });

      if (options.password) {
        newRoom.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
      }

      newRoom.owner = socket.user;

      const room = await newRoom.save();
      io.emit(Protocol.ROOM_CREATED, roomMask(room));
      joinRoom(room, (err, r) => {
        if (err) {
          return cb(err, r);
        }

        cb(null, r);
        if (r.type === 'grand_prix' && !r.started && r.startTime) {
          awaitRoomStart(r);
        }
      });
    });

    /* Admin Actions */
    socket.on(Protocol.DELETE_ROOM, async (id, cb) => {
      if (!checkAdmin() && +socket.userId !== 8184) {
        return cb({
          statusCode: 401,
          message: 'Must be admin to delete room',
        });
      }

      Room.deleteOne({ _id: id }).then((res) => {
        if (res.deletedCount > 0) {
          socket.room = undefined;
          cb(null);
          broadcastToEveryone(Protocol.ROOM_DELETED, id);
        } else if (res.deletedCount > 1) {
          logger.error(168, 'big problemo');
        }
      });
    });

    // Register user for room they are currently in
    socket.on(Protocol.UPDATE_REGISTRATION, async (registration) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      try {
        const room = await socket.room.updateRegistration(socket.userId, registration);

        broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    // Register user for room they are currently in
    socket.on(Protocol.UPDATE_USER, async ({ userId, competing, registered }) => {
      if (!checkAdmin()) {
        return;
      }

      try {
        if (competing !== undefined) {
          socket.room.competing.set(userId.toString(), competing);
        }

        if (registered !== undefined) {
          socket.room.registered.set(userId.toString(), registered);
        }

        const room = await socket.room.save();

        broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.SUBMIT_RESULT, async ({ id, result }) => {
      if (!socket.user || !socket.roomId) {
        return;
      }

      try {
        if (!socket.room.attempts[id]) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SUBMIT_RESULT,
            message: 'Invalid ID for attempt submission',
          });
          return;
        }

        if (socket.room.type === 'grand_prix') {
          result.penalties.DNF = result.penalties.DNF
            || id < socket.room.attempts.length - 1;
        }
        socket.room.attempts[id].results.set(socket.user.id.toString(), result);
        socket.room.waitingFor.set(socket.user.id.toString(), false);

        const r = await socket.room.save();

        broadcastToAllInRoom(r.accessCode, Protocol.NEW_RESULT, {
          id,
          result,
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

    socket.on(Protocol.SEND_EDIT_RESULT, async (result) => {
      if (!socket.user || !socket.roomId) {
        return;
      }

      try {
        if (!socket.room.attempts[result.id]) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SEND_EDIT_RESULT,
            message: 'Invalid ID for result modification',
          });
          return;
        }

        const { userId } = result;
        if (userId !== socket.user.id && socket.user.id !== socket.room.admin.id) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SEND_EDIT_RESULT,
            message: 'Invalid permissions to edit result',
          });
          return;
        }

        socket.room.attempts[result.id].results.set(userId.toString(), result.result);

        const r = await socket.room.save();

        broadcastToAllInRoom(r.accessCode, Protocol.EDIT_RESULT, {
          ...result,
          userId,
        });
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

    socket.on(Protocol.EDIT_ROOM, async (options) => {
      if (!checkAdmin()) {
        return;
      }

      try {
        const room = await socket.room.edit(options);
        broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));

        Room.find().then((rooms) => {
          broadcastToEveryone(Protocol.UPDATE_ROOMS, rooms.map(roomMask));
        });
      } catch (e) {
        (logger.error(e));
      }
    });

    socket.on(Protocol.START_ROOM, async () => {
      if (!checkAdmin()) {
        return;
      }

      const room = await socket.room.start();
      try {
        startTimer(room);
        broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on(Protocol.PAUSE_ROOM, async () => {
      if (!checkAdmin()) {
        return;
      }

      pauseTimer(await socket.room.pause());

      broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(socket.room));
    });

    socket.on(Protocol.KICK_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      io.in(encodeUserRoom(userId, socket.room._id)).clients(async (err, clients) => {
        if (err) {
          return logger.error(err);
        }

        clients.forEach((sId) => {
          io.to(sId).emit(Protocol.KICKED);
          io.of('/').adapter.remoteLeave(sId, socket.room.accessCode);
          io.of('/').adapter.remoteLeave(sId, encodeUserRoom(userId, socket.room._id));
        });

        try {
          const room = await socket.room.dropUser({ id: userId });

          if (!room) {
            logger.debug('User kick failed for some reason');
          }

          broadcastToAllInRoom(socket.room.accessCode, Protocol.USER_LEFT, userId);
          broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));

          if (room.doneWithScramble()) {
            logger.debug('everyone done, sending new scramble');
            sendNewScramble(room);
          }
        } catch (e) {
          logger.error(e);
        }
      });
    });

    socket.on(Protocol.BAN_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      io.in(encodeUserRoom(userId, socket.room._id)).clients(async (err, clients) => {
        if (err) {
          return logger.error(err);
        }

        clients.forEach((sId) => {
          io.to(sId).emit(Protocol.BANNED);
          io.of('/').adapter.remoteLeave(sId, socket.room.accessCode);
          io.of('/').adapter.remoteLeave(sId, encodeUserRoom(userId, socket.room._id));
        });

        try {
          const room = await socket.room.banUser(userId);

          if (!room) {
            logger.debug('User ban failed for some reason');
          }

          broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
          broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));

          if (room.doneWithScramble()) {
            logger.debug('everyone done, sending new scramble');
            sendNewScramble(room);
          }
        } catch (e) {
          logger.error(e);
        }
      });
    });

    socket.on(Protocol.UNBAN_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      try {
        const room = await socket.room.unbanUser(userId);

        if (!room) {
          logger.debug('User unban failed for some reason');
        }

        broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM, joinRoomMask(room));
        broadcastToEveryone(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));
      } catch (e) {
        logger.error(e);
      }
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

    socket.on(Protocol.DISCONNECT, async () => {
      logger.debug(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`);

      if (socket.roomId) {
        socket.room = await fetchRoom(socket.roomId);
      }

      if (socket.user && socket.room) {
        await leaveRoom();
      }

      if (socket.userId) {
        io.of('/').adapter.clients((err, clients) => {
          logger.debug(`Users online: ${clients.length}`);
          broadcastToEveryone(Protocol.UPDATE_USER_COUNT, clients.length);
        });
      }
    });

    socket.on(Protocol.LEAVE_ROOM, async () => {
      if (socket.room) {
        socket.leave(socket.room.accessCode);

        if (socket.user) {
          socket.leave(encodeUserRoom(socket.userId, socket.room._id));
          await leaveRoom();
        }
      }

      delete socket.room;
      delete socket.roomId;
    });

    // option is a true or false value of whether or not they're kibitzing
    socket.on(Protocol.UPDATE_COMPETING, async (competing) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      broadcastToAllInRoom(socket.room.accessCode, Protocol.UPDATE_COMPETING, {
        userId: socket.userId,
        competing,
      });

      socket.room.competing.set(socket.userId.toString(), competing);

      if (competing) {
        const room = await socket.room.save();

        // We went from no one competing to 1 person competing, give them a scramble.
        if (room.users.filter((user) => room.competing.get(user.id.toString())).length === 1) {
          // if the lone user that is now competing hasn't done the attempt, let them doing it.
          // Else, gen a new scramble.
          const latest = room.latestAttempt;
          if (!latest.results.get(socket.userId.toString())) {
            room.waitingFor.set(socket.userId.toString(), true);
            broadcastToAllInRoom(room.accessCode, Protocol.UPDATE_ROOM,
              joinRoomMask(room));
          } else if (room.doneWithScramble()) {
            logger.debug('everyone done because user kibitzed, sending new scramble');
            sendNewScramble(room);
          }
        }
      } else {
        socket.room.waitingFor.set(socket.userId.toString(), false);

        const room = await socket.room.save();

        if (room.doneWithScramble()) {
          logger.debug('everyone done because user kibitzed, sending new scramble');
          sendNewScramble(room);
        }
      }
    });
  });

  return server.listen(process.env.SOCKETIO_PORT || config.socketio.port);
};

init();
