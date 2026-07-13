const _ = require('lodash');
const bcrypt = require('bcrypt');
const Protocol = require('../../../client/src/lib/protocol.json');
const ChatMessage = require('../lib/ChatMessage');
const { parseCommand } = require('../lib/commands');
const config = require('../../runtimeConfig');
const logger = require('../../logger');
const metrics = require('../../metrics');
const { markRoomDeleted } = require('../../postgres/dualWrite');
const { Room, User } = require('../../models');
const { encodeUserRoom } = require('../utils');
const roomMap = require('../lib/roomMap');
const {
  canAccessRoom,
  canDeleteRoom,
  isRoomAdmin,
} = require('../lib/roomAuthorization');
const { isRoomTypeEnabled: checkRoomTypeEnabled } = require('../lib/roomAvailability');
const { removeUserFromRoomSockets } = require('../lib/roomSockets');
const { createReconnectGrace } = require('../lib/reconnectGrace');
const {
  createResultSubmissionService,
  ResultSubmissionError,
} = require('../lib/resultSubmission');
const {
  createSafeSocketHandler,
  optionalAcknowledgment,
} = require('../lib/socketHandler');

const PASSWORD_SALT_ROUNDS = 10;

const publicRoomKeys = ['_id', 'name', 'event', 'usersLength', 'private', 'type', 'owner', 'requireRevealedIdentity', 'startTime', 'started', 'twitchChannel'];
const privateRoomKeys = [...publicRoomKeys, 'users', 'competing', 'waitingFor', 'banned', 'attempts', 'admin', 'accessCode', 'inRoom', 'registered', 'nextSolveAt'];

// Data for people not in room
const roomMask = (room) => ({
  ..._.partial(_.pick, _, publicRoomKeys)(room),
  users: room.private
    ? undefined
    : room.usersInRoom.map((user) => ({
      id: user.id,
      displayName: user.displayName,
    })),
  registeredUsers: room.users.filter((user) => room.registered.get(user.id.toString())).length,
});

// Data for people in room
const joinRoomMask = _.partial(_.pick, _, privateRoomKeys);
const isRoomTypeEnabled = (type) => checkRoomTypeEnabled(type, config.grandPrix.enabled);

const fetchRoom = (id) => Room.findById({ _id: id }).populate('users').populate('admin').populate('owner');

const getRooms = (userId) => Room.find().populate('users').populate('admin').populate('owner')
  .then((rooms) => rooms.filter((room) => (
    isRoomTypeEnabled(room.type)
      && (userId ? !room.banned.get(userId.toString()) : true)
  )).map(roomMask));

const roomTimerObj = {};

module.exports = (io, middlewares) => {
  const ns = () => io.of('/rooms');

  middlewares.forEach((middleware) => {
    ns().use(middleware);
  });

  const socketsForUserRoom = async (userId, roomId) => ns().adapter.sockets(
    new Set([encodeUserRoom(userId, roomId)]),
  );

  const hasOtherSocketsForUserRoom = async (userId, roomId, currentSocketId) => {
    const sockets = await socketsForUserRoom(userId, roomId);
    return [...sockets].some((socketId) => socketId !== currentSocketId);
  };

  const hasActiveSocketsForUserRoom = async (userId, roomId) => (
    (await socketsForUserRoom(userId, roomId)).size > 0
  );

  async function listActiveRoomUsers() {
    const rooms = await Room.find()
      .populate('users')
      .populate('admin')
      .populate('owner');

    return rooms.flatMap((room) => room.usersInRoom.map((user) => ({
      roomId: room._id,
      userId: user.id,
      membershipRevision: room.membershipRevision,
      presenceRevision: room.presenceRevision.get(user.id.toString()),
      leaveReason: 'disconnect',
    })));
  }

  async function createAndSendNewScramble(room) {
    const updatedRoom = await room.newAttempt();
    logger.debug('Sending new scramble to room', { roomId: room.id });
    ns().in(room.accessCode).emit(Protocol.NEW_ATTEMPT, {
      waitingFor: updatedRoom.waitingFor,
      attempt: updatedRoom.attempts[updatedRoom.attempts.length - 1],
    });
    return updatedRoom;
  }

  function sendNewScramble(room) {
    return createAndSendNewScramble(room).catch((err) => {
      logger.error(err);
    });
  }

  const resultSubmissions = createResultSubmissionService({
    advanceRoom: createAndSendNewScramble,
    fetchRoom,
  });

  function sendGlobalRoomUpdate(room) {
    if (isRoomTypeEnabled(room.type)) {
      ns().emit(Protocol.GLOBAL_ROOM_UPDATED, roomMask(room));
    }
  }

  function sendAdminUpdate(room) {
    if (room.admin) {
      ns().in(room.accessCode).emit(Protocol.UPDATE_ADMIN, room.admin);
    }
  }

  async function finalizeUserDeparture({
    roomId, userId, connectionId, leaveReason, membershipRevision, presenceRevision,
  }) {
    const userKey = userId.toString();

    const room = await fetchRoom(roomId);
    if (!room || !room.inRoom.get(userKey)
      || room.membershipRevision !== membershipRevision
      || room.presenceRevision.get(userKey) !== presenceRevision) {
      return false;
    }

    if (leaveReason === 'disconnect'
      && await hasActiveSocketsForUserRoom(userId, roomId)) {
      return false;
    }

    // The membership revision is the departure generation. A failed claim is
    // terminal: retrying it after a rejoin would remove the new membership.
    const departure = await room.dropUserAtomically(
      { id: userId },
      membershipRevision,
      presenceRevision,
    );
    if (!departure) {
      return false;
    }

    const { room: updatedRoom, adminChanged } = departure;
    if (adminChanged) {
      sendAdminUpdate(updatedRoom);
    }

    await metrics.endRoomVisit({
      room: updatedRoom,
      userId,
      connectionId,
      leaveReason,
      activeUserCount: updatedRoom.usersLength,
    });

    ns().in(updatedRoom.accessCode).emit(Protocol.USER_LEFT, userId);
    sendGlobalRoomUpdate(updatedRoom);

    if (updatedRoom.doneWithScramble()) {
      logger.debug('everyone done, sending new scramble');
      await sendNewScramble(updatedRoom);
    }

    return true;
  }

  const reconnectGrace = createReconnectGrace({
    graceMs: config.socketio.reconnectGraceMs,
    hasActiveSockets: hasActiveSocketsForUserRoom,
    finalizeDeparture: finalizeUserDeparture,
    listActiveUsers: listActiveRoomUsers,
    logger,
  });

  reconnectGrace.startReconciliation();

  const interval = 60 * 1000; // 30 seconds

  function startTimer(room) {
    if (!room) {
      logger.error('Attempting to start undefined room');
      return;
    }

    const newSolve = () => {
      fetchRoom(room._id).then(async (r) => {
        if (!r) {
          return;
        }

        const nextSolveAt = new Date(Date.now() + interval);
        logger.debug('nextSolveAt', { nextSolveAt });
        await sendNewScramble(r);
        r.nextSolveAt = nextSolveAt;
        await r.save();
        ns().in(room.accessCode).emit(Protocol.NEXT_SOLVE_AT, nextSolveAt);
      });
    };

    roomTimerObj[room._id] = setInterval(() => {
      newSolve();
    }, interval);

    const nextSolveAt = new Date(Date.now() + interval);
    logger.info('Starting timer for room; first solve at: ', { roomId: room._id, nextSolveAt });
    ns().in(room.accessCode).emit(Protocol.NEXT_SOLVE_AT, nextSolveAt);
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
      fetchRoom(room._id).then((r) => {
        r.start().then((rr) => {
          ns().in(rr.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(rr));
          startTimer(rr);
        });
      });
    }, time);
  }

  function pauseTimer(room) {
    clearInterval(roomTimerObj[room._id]);
  }

  if (config.grandPrix.enabled) {
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
  }

  async function updateClientsWithUsers() {
    const sockets = [...await ns().adapter.allRooms([])]
      .filter((room) => room.indexOf('user/') > -1)
      .map((user) => +user.split('/')[1]);

    const users = (await User.find({
      id: {
        $in: sockets,
      },
    })).map((user) => user.toJSON()).filter((user) => !!user.displayName);

    ns().emit(Protocol.UPDATE_USERS_IN_LOBBY, {
      users,
    });
  }

  ns().on('connection', async (socket) => {
    const on = createSafeSocketHandler(socket, logger, Protocol.ERROR);

    logger.debug(`socket ${socket.id} connected to rooms; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    socket.use(async ([event], next) => {
      try {
        if (socket.roomId) {
          const room = await fetchRoom(socket.roomId);
          if (!canAccessRoom(socket.userId, room)) {
            logger.info('Rejecting room event from a removed or banned user', {
              event,
              roomId: socket.roomId,
              userId: socket.userId,
            });

            if (room) {
              socket.leave(room.accessCode);
              if (socket.userId) {
                socket.leave(encodeUserRoom(socket.userId, socket.roomId));
              }
            }

            delete socket.room;
            delete socket.roomId;
            return next(new Error('Socket is no longer authorized for this room'));
          }
          socket.room = room;
        }
        return next();
      } catch (err) {
        return next(err);
      }
    });

    getRooms(socket.userId)
      .then((rooms) => {
        socket.emit(Protocol.UPDATE_ROOMS, rooms);
      })
      .catch((e) => {
        logger.error(e);
        socket.emit(Protocol.ERROR, {
          statusCode: 500,
          message: 'Failed to fetch rooms',
        });
      });

    updateClientsWithUsers();

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
        logger.debug('Unauthenticated user or user not in room attempting to perform admin action');
        return false;
      } if (!isRoomAdmin(socket.user.id, socket.room)) {
        logger.debug('Non-admin attempting to perform admin action');
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          message: 'Must be admin of room',
        });
        return false;
      }
      return true;
    }

    // Only deals with removing authenticated users from a room
    async function leaveRoom(leaveReason) {
      try {
        const hasOtherSockets = await hasOtherSocketsForUserRoom(
          socket.userId,
          socket.roomId,
          socket.id,
        );
        if (hasOtherSockets) {
          return;
        }

        reconnectGrace.cancel(socket.roomId, socket.userId);
        await reconnectGrace.finalize({
          roomId: socket.roomId,
          userId: socket.userId,
          connectionId: socket.id,
          membershipRevision: socket.room.membershipRevision,
          presenceRevision: socket.room.presenceRevision.get(socket.userId.toString()),
          leaveReason,
        });
      } catch (e) {
        logger.error(e);
      }
    }

    async function joinRoom(
      room,
      cb,
      spectating,
      { password, reauthorizeOnRecovery = false } = {},
    ) {
      if (socket.roomId) {
        if (String(socket.roomId) === String(room._id)) {
          socket.room = socket.room || room;
          return cb(null, joinRoomMask(socket.room));
        }

        logger.debug('Socket is already in room', { roomId: socket.room._id });
        await metrics.recordRoomJoinFailure({
          room: socket.room,
          userId: socket.userId,
          connectionId: socket.id,
          failureReason: 'already_in_room',
        });
        return cb({
          statusCode: 400,
          message: 'Socket is already in room',
        });
      }

      socket.join(room.accessCode);
      socket.roomId = room._id;

      if (!socket.user) {
        logger.debug('Socket is not authenticated but joining anyways', { roomId: room._id, userId: socket.userId });
        socket.room = room;
        await metrics.beginRoomVisit({
          room,
          connectionId: socket.id,
          activeUserCount: room.usersLength,
        });
        return cb(null, joinRoomMask(room));
      }

      socket.join(encodeUserRoom(socket.userId, room._id));
      const waitedForCleanup = await reconnectGrace.cancel(room._id, socket.userId);
      const activeRoom = waitedForCleanup ? await fetchRoom(room._id) : room;
      if (!activeRoom) {
        return cb({
          statusCode: 404,
          message: 'Room no longer exists',
        });
      }

      const presentRoom = await activeRoom.advancePresenceRevision(socket.userId);
      if (presentRoom) {
        socket.room = presentRoom;
        await metrics.beginRoomVisit({
          room: presentRoom,
          userId: socket.userId,
          connectionId: socket.id,
          activeUserCount: presentRoom.usersLength,
        });
        return cb(null, joinRoomMask(presentRoom));
      }

      const currentRoom = await fetchRoom(room._id);
      if (!currentRoom) {
        return cb({
          statusCode: 404,
          message: 'Room no longer exists',
        });
      }
      if (reauthorizeOnRecovery) {
        const rejectRecoveryJoin = (error) => {
          socket.leave(room.accessCode);
          socket.leave(encodeUserRoom(socket.userId, room._id));
          delete socket.room;
          delete socket.roomId;
          return cb(error);
        };
        const userKey = socket.userId.toString();
        if (!isRoomTypeEnabled(currentRoom.type)) {
          return rejectRecoveryJoin({
            statusCode: 403,
            message: 'Grand Prix rooms are disabled',
          });
        }
        if (currentRoom.private && (!password || !(await currentRoom.authenticate(password)))) {
          return rejectRecoveryJoin({
            statusCode: 403,
            message: 'Invalid password',
          });
        }
        if (currentRoom.banned.get(userKey)) {
          return rejectRecoveryJoin({
            statusCode: 401,
            message: 'Banned',
            banned: true,
          });
        }
        if (currentRoom.requireRevealedIdentity && !socket.user.showWCAID) {
          return rejectRecoveryJoin({
            statusCode: 403,
            message: 'Must be showing WCA Identity to join room.',
          });
        }
      }
      const r = await currentRoom.addUser(socket.user, spectating, sendAdminUpdate);
      if (!r) {
        const fencedRoom = await currentRoom.advancePresenceRevision(socket.userId);
        if (!fencedRoom) {
          return cb({
            statusCode: 409,
            message: 'Room membership changed while joining',
          });
        }
        socket.room = fencedRoom;
        await metrics.beginRoomVisit({
          room: fencedRoom,
          userId: socket.userId,
          connectionId: socket.id,
          activeUserCount: fencedRoom.usersLength,
        });
        return cb(null, joinRoomMask(fencedRoom));
      }

      socket.room = r;
      await metrics.beginRoomVisit({
        room: r,
        userId: socket.userId,
        connectionId: socket.id,
        activeUserCount: r.usersLength,
        replaceActive: true,
      });
      socket.emit(Protocol.JOIN, joinRoomMask(r));
      cb(null, joinRoomMask(r));

      broadcast(Protocol.USER_JOIN, socket.user);
      sendGlobalRoomUpdate(r);

      if (r.doneWithScramble()) {
        logger.debug('everyone done, sending new scramble');
        sendNewScramble(r);
      }
    }

    // Socket wants to join room.
    on(Protocol.JOIN_ROOM, async (payload = {}, cb) => {
      const acknowledgment = optionalAcknowledgment(cb);
      const { id, spectating, password } = payload || {};

      const rejectJoin = async (failureReason, error, room) => {
        await metrics.recordRoomJoinFailure({
          room,
          userId: socket.userId,
          connectionId: socket.id,
          failureReason,
        });
        return acknowledgment({
          ...error,
          reason: failureReason,
        }, room ? roomMask(room) : undefined);
      };

      try {
        const room = await fetchRoom(id);
        if (!room) {
          return rejectJoin('not_found', {
            statusCode: 404,
            message: `Could not find room with id ${id}`,
          });
        }

        if (!isRoomTypeEnabled(room.type)) {
          return rejectJoin('grand_prix_disabled', {
            statusCode: 403,
            message: 'Grand Prix rooms are disabled',
          }, room);
        }

        if (socket.roomId) {
          if (String(socket.roomId) === String(room._id)) {
            socket.room = room;
            return acknowledgment(null, joinRoomMask(room));
          }

          return rejectJoin('already_in_room', {
            statusCode: 400,
            message: 'Socket is already in room',
          }, room);
        }

        if (room.private && !password) {
          return rejectJoin('password_required', {
            statusCode: 403,
            message: 'Room requires password to join',
          }, room);
        }

        if (room.private && !(await room.authenticate(password))) {
          return rejectJoin('invalid_password', {
            statusCode: 403,
            message: 'Invalid password',
          }, room);
        }

        if (socket.userId && room.banned.get(socket.userId.toString())) {
          logger.debug(`Banned user ${socket.user.id} is trying to join room ${room._id}`);
          return rejectJoin('banned', {
            statusCode: 401,
            message: 'Banned',
            banned: true,
          }, room);
        }

        if (room.requireRevealedIdentity && (!socket.user || !socket.user.showWCAID)) {
          return rejectJoin('identity_required', {
            statusCode: 403,
            message: 'Must be showing WCA Identity to join room.',
          }, room);
        }

        return await joinRoom(room, acknowledgment, spectating, {
          password,
          reauthorizeOnRecovery: true,
        });
      } catch (e) {
        logger.error(e);
        return rejectJoin('internal_error', {
          statusCode: 500,
          message: 'Failed to join room',
        });
      }
    });

    on(Protocol.CREATE_ROOM, async (options = {}, cb) => {
      const acknowledgment = optionalAcknowledgment(cb);

      if (!isLoggedIn()) {
        return acknowledgment({
          statusCode: 401,
          message: 'Must be logged in to create a room',
        });
      }

      if (options.type === 'grand_prix' && !config.grandPrix.enabled) {
        return acknowledgment({
          statusCode: 403,
          message: 'Grand Prix rooms are disabled',
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
        newRoom.password = await bcrypt.hash(options.password, PASSWORD_SALT_ROUNDS);
      }

      newRoom.owner = socket.user;

      const room = await newRoom.save();
      await metrics.recordRoomCreated({
        room,
        userId: socket.userId,
      });
      ns().emit(Protocol.ROOM_CREATED, roomMask(room));
      return joinRoom(room, (err, r) => {
        if (err) {
          return acknowledgment(err, r);
        }

        acknowledgment(null, r);
        if (r.type === 'grand_prix' && !r.started && r.startTime) {
          awaitRoomStart(r);
        }
      });
    });

    /* Admin Actions */
    on(Protocol.DELETE_ROOM, async (id, cb) => {
      const acknowledgment = optionalAcknowledgment(cb);

      try {
        const room = await fetchRoom(id);
        if (!room) {
          return acknowledgment({
            statusCode: 404,
            message: 'Could not find room to delete',
          });
        }

        if (!canDeleteRoom(socket.userId, room)) {
          return acknowledgment({
            statusCode: 403,
            message: 'Must be the room owner or admin to delete room',
          });
        }

        const res = await Room.deleteOne({ _id: room._id });
        if (res.deletedCount > 0) {
          await markRoomDeleted(room._id);
          socket.room = undefined;
          acknowledgment(null);
          ns().emit(Protocol.ROOM_DELETED, id);
        } else {
          acknowledgment({
            statusCode: 404,
            message: 'Could not find room to delete',
          });
        }
      } catch (err) {
        logger.error(err);
        acknowledgment({
          statusCode: 500,
          message: 'Failed to delete room',
        });
      }
    });

    // Register user for room they are currently in
    on(Protocol.UPDATE_REGISTRATION, async (registration) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      try {
        const room = await socket.room.updateRegistration(socket.userId, registration);

        ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    // Register user for room they are currently in
    on(Protocol.UPDATE_USER, async ({ userId, competing, registered }) => {
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

        ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    on(Protocol.SUBMIT_RESULT, async (payload = {}, cb) => {
      const acknowledgment = optionalAcknowledgment(cb);
      const rejectSubmission = (error) => {
        if (typeof cb === 'function') {
          return acknowledgment(error);
        }
        if (socket.connected) {
          return socket.emit(Protocol.ERROR, {
            ...error,
            event: Protocol.SUBMIT_RESULT,
          });
        }
        return undefined;
      };

      if (!socket.user) {
        return rejectSubmission({
          statusCode: 401,
          message: 'Must be logged in to submit a result',
          retryable: false,
        });
      }
      if (!socket.roomId) {
        return rejectSubmission({
          statusCode: 409,
          message: 'Must rejoin the room before submitting a result',
          retryable: true,
        });
      }

      const {
        id, attemptKey, result, submissionId,
      } = payload || {};
      let submission;
      try {
        submission = await resultSubmissions.submit({
          roomId: socket.roomId,
          userId: socket.user.id,
          attemptId: id,
          attemptKey,
          result,
          submissionId,
          onSaved: ({ room, result: savedResult }) => {
            socket.room = room;
            try {
              ns().in(room.accessCode).emit(Protocol.NEW_RESULT, {
                id,
                result: savedResult,
                userId: socket.user.id,
              });
            } catch (err) {
              logger.error(err);
            }
            Promise.resolve()
              .then(() => metrics.recordRoomResult({
                room,
                userId: socket.userId,
              }))
              .catch((err) => logger.error(err));
          },
        });
      } catch (err) {
        if (err.cause) {
          logger.error(err.cause);
        } else if (!(err instanceof ResultSubmissionError)) {
          logger.error(err);
        }
        const error = err instanceof ResultSubmissionError
          ? err.toResponse()
          : {
            statusCode: 500,
            message: 'Failed to save result',
            retryable: true,
          };
        return rejectSubmission(error);
      }

      socket.room = submission.room;
      acknowledgment(null, {
        submissionId: submission.submissionId,
        status: submission.status,
      });
      return undefined;
    });

    on(Protocol.SEND_EDIT_RESULT, async (result) => {
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
        if (userId !== socket.user.id && !isRoomAdmin(socket.user.id, socket.room)) {
          socket.emit(Protocol.ERROR, {
            statusCode: 400,
            event: Protocol.SEND_EDIT_RESULT,
            message: 'Invalid permissions to edit result',
          });
          return;
        }

        socket.room.attempts[result.id].results.set(userId.toString(), result.result);

        const r = await socket.room.save();

        ns().in(r.accessCode).emit(Protocol.EDIT_RESULT, {
          ...result,
          userId,
        });
      } catch (e) {
        logger.error(e);
      }
    });

    on(Protocol.REQUEST_SCRAMBLE, async () => {
      if (!checkAdmin()) {
        return;
      }
      if (!isRoomTypeEnabled(socket.room.type)) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.REQUEST_SCRAMBLE,
          message: 'Grand Prix rooms are disabled',
        });
        return;
      }

      sendNewScramble(socket.room);
    });

    on(Protocol.CHANGE_EVENT, async (event) => {
      if (!checkAdmin()) {
        return;
      }
      if (!isRoomTypeEnabled(socket.room.type)) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.CHANGE_EVENT,
          message: 'Grand Prix rooms are disabled',
        });
        return;
      }

      socket.room.changeEvent(event).then((r) => {
        ns().in(r.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(socket.room));
      }).catch(logger.error);
    });

    on(Protocol.EDIT_ROOM, async (options = {}, cb) => {
      const acknowledgment = optionalAcknowledgment(cb);
      const rejectEdit = (error) => {
        const response = {
          ...error,
          event: Protocol.EDIT_ROOM,
        };

        if (typeof cb === 'function') {
          return acknowledgment(response);
        }

        return socket.emit(Protocol.ERROR, response);
      };

      if (!socket.user) {
        logger.debug('Unauthenticated user attempting to edit a room');
        return rejectEdit({
          statusCode: 403,
          message: 'Must be logged in',
        });
      }

      if (!socket.room) {
        logger.debug('User not in a room attempting to edit it');
        return rejectEdit({
          statusCode: 400,
          message: 'Must be in a room',
        });
      }

      if (!isRoomAdmin(socket.user.id, socket.room)) {
        logger.debug('Non-admin attempting to edit a room');
        return rejectEdit({
          statusCode: 403,
          message: 'Must be admin of room',
        });
      }

      if (options.type === 'grand_prix' && !config.grandPrix.enabled) {
        logger.error(`${socket.id} attempted to edit room to grand_prix`);
        return rejectEdit({
          statusCode: 403,
          message: 'Grand Prix rooms are disabled',
        });
      }

      try {
        const room = await socket.room.edit(options);
        ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
        acknowledgment(null, joinRoomMask(room));

        Room.find().then((rooms) => {
          ns().emit(
            Protocol.UPDATE_ROOMS,
            rooms.filter((candidate) => isRoomTypeEnabled(candidate.type)).map(roomMask),
          );
        });
      } catch (e) {
        logger.error(e);
        return rejectEdit({
          statusCode: e.statusCode || 500,
          message: e.statusCode ? e.message : 'Failed to edit room',
        });
      }
    });

    on(Protocol.START_ROOM, async () => {
      if (!checkAdmin()) {
        return;
      }
      if (!isRoomTypeEnabled(socket.room.type)) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.START_ROOM,
          message: 'Grand Prix rooms are disabled',
        });
        return;
      }

      const room = await socket.room.start();
      try {
        startTimer(room);
        ns().in(socket.room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
      } catch (e) {
        logger.error(e);
      }
    });

    on(Protocol.PAUSE_ROOM, async () => {
      if (!checkAdmin()) {
        return;
      }

      pauseTimer(await socket.room.pause());

      ns().in(socket.room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(socket.room));
    });

    on(Protocol.KICK_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      if (String(userId) === String(socket.user.id)) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          event: Protocol.KICK_USER,
          message: 'Cannot kick yourself; leave the room instead',
        });
        return;
      }

      try {
        const room = await socket.room.dropUser({ id: userId });

        await metrics.endRoomVisit({
          room,
          userId,
          leaveReason: 'kick',
          activeUserCount: room.usersLength,
        });

        ns().in(encodeUserRoom(userId, socket.room._id)).emit(Protocol.KICKED);
        removeUserFromRoomSockets(ns(), userId, socket.room);

        if (!room) {
          logger.debug('User kick failed for some reason');
        }

        ns().in(socket.room.accessCode).emit(Protocol.USER_LEFT, userId);
        sendGlobalRoomUpdate(room);

        if (room.doneWithScramble()) {
          logger.debug('everyone done, sending new scramble');
          sendNewScramble(room);
        }
      } catch (err) {
        logger.error(err);
      }
    });

    on(Protocol.BAN_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      if (String(userId) === String(socket.user.id)) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          event: Protocol.BAN_USER,
          message: 'Cannot ban yourself; leave the room instead',
        });
        return;
      }

      try {
        const room = await socket.room.banUser(userId);

        await metrics.endRoomVisit({
          room,
          userId,
          leaveReason: 'ban',
          activeUserCount: room.usersLength,
        });

        ns().in(encodeUserRoom(userId, socket.room._id)).emit(Protocol.BANNED);
        removeUserFromRoomSockets(ns(), userId, socket.room);

        if (!room) {
          logger.debug('User ban failed for some reason');
        }

        ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
        sendGlobalRoomUpdate(room);

        if (room.doneWithScramble()) {
          logger.debug('everyone done, sending new scramble');
          sendNewScramble(room);
        }
      } catch (e) {
        logger.error(e);
      }
    });

    on(Protocol.UNBAN_USER, async (userId) => {
      if (!checkAdmin()) {
        return;
      }

      try {
        const room = await socket.room.unbanUser(userId);

        if (!room) {
          logger.debug('User unban failed for some reason');
        }

        ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM, joinRoomMask(room));
        sendGlobalRoomUpdate(room);
      } catch (e) {
        logger.error(e);
      }
    });

    // Simplest event here. Just echo the message to everyone else.
    on(Protocol.MESSAGE, (message) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      if (message.text[0] === '/') {
        parseCommand(ns, socket, message.text);
      } else {
        ns().in(socket.room.accessCode).emit(Protocol.MESSAGE,
          new ChatMessage(message.text, socket.user.id));
      }
    });

    // Simplest event here. Just echo the message to everyone else.
    on(Protocol.UPDATE_STATUS, (status) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      broadcast(Protocol.UPDATE_STATUS, status);
    });

    on(Protocol.DISCONNECT, async () => {
      try {
        if (socket.roomId) {
          socket.room = await fetchRoom(socket.roomId);
        }

        logger.info(`socket ${socket.id} disconnected; Left room: ${socket.room ? socket.room.name : 'Null'}`, { roomId: socket.roomId });

        if (socket.user && socket.room) {
          reconnectGrace.schedule({
            roomId: socket.roomId,
            userId: socket.userId,
            connectionId: socket.id,
            membershipRevision: socket.room.membershipRevision,
            presenceRevision: socket.room.presenceRevision.get(socket.userId.toString()),
            leaveReason: 'disconnect',
          });
        } else if (socket.room) {
          await metrics.endRoomVisit({
            room: socket.room,
            connectionId: socket.id,
            leaveReason: 'disconnect',
            activeUserCount: socket.room.usersLength,
          });
        }

        updateClientsWithUsers();
      } catch (err) {
        logger.error(err);
      }
    });

    on(Protocol.LEAVE_ROOM, async () => {
      if (socket.room) {
        if (socket.user) {
          // Exclude this tab before checking whether another tab keeps the
          // user's room membership active. Otherwise simultaneous leaves can
          // each see the other socket and neither finalizes the departure.
          socket.leave(encodeUserRoom(socket.userId, socket.room._id));
          await leaveRoom('explicit');
        } else {
          await metrics.endRoomVisit({
            room: socket.room,
            connectionId: socket.id,
            leaveReason: 'explicit',
            activeUserCount: socket.room.usersLength,
          });
        }

        socket.leave(socket.room.accessCode);
      }

      delete socket.room;
      delete socket.roomId;
    });

    // option is a true or false value of whether or not they're kibitzing
    on(Protocol.UPDATE_COMPETING, async (competing) => {
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      ns().in(socket.room.accessCode).emit(Protocol.UPDATE_COMPETING, {
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
            ns().in(room.accessCode).emit(Protocol.UPDATE_ROOM,
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

    on(Protocol.ADMIN, (cb) => {
      if (!socket.userId || +socket.userId !== 8184) {
        return;
      }

      roomMap(ns).then((sockets) => {
        cb(sockets);
      });
    });
  });
};
