const http = require('http');
const Protocol = require('../../app/lib/protocol.js');
const bcrypt = require('bcrypt');
const uuidv1 = require('uuid/v1');
const Scrambo = require('scrambo');
const socketLogger = require('./logger');
const expressSocketSession = require('express-socket.io-session');
const { User } = require('../models');

class Room {
  constructor (options) {
    this.id = options.id || uuidv1();
    this.name = options.name;
    this.event = options.event || '333';
    this.scrambler = new Scrambo().type(this.event);
    this.accessCode = uuidv1(); // unique ID to use for rooms; #SecurityThroughObscurity
    this.private = !!options.password; // determine if room is private based on if password is defined
    this.admin = undefined;

    if (options.password) {
      this.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
    }

    this.users = options.users || [];
    this.attempts = [];
  }

  addUser (user) {
    this.users.push(user);
    if (this.users.length === 1) {
      this.admin = user;
    }
  }

  doneWithScramble () {
    if (this.users.length === 0) {
      return false;
    }
  
    if (this.attempts.length === 0) {
      return 'first'
    } else {
      const latest = this.attempts[this.attempts.length - 1];
      // check that for every user, there exists a result.
      return this.users.every(user => latest.results[user.id]);
    }
  }

  newAttempt () {
    const attempt = this.genAttempt();

    this.attempts.push(attempt);
    return attempt;
  }

  genAttempt () {
    return {
      id: this.attempts.length,
      scrambles: this.scrambler.get(1),
      results: {},
    };
  }

  latestAttempt () {
    return this.attempts[this.attempts.length - 1];
  }
}

let Rooms = [];

Rooms.push(new Room({
  id: '62a53540-6f81-11ea-af07-c1038094a32d',
  name: 'Default',
  password: false,
}));

const getRoom = (options) => Rooms.find(i => options.id ? i.id === options.id : i.accessCode === options.accessCode);

function attachUser (socket, next) {
  const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : null;

  if (!userId) {
    return next();
  }

  User.findOne({id: userId}).then(user => {
    socket.user = user;
    next();
  }).catch(err => {
    console.error(err);
  });
}

module.exports = function ({app, expressSession}) {
  const server = http.Server(app);
  const io = require('socket.io')(server);

  io.use(expressSocketSession(expressSession, {
    autoSave: true
  }));
  
  io.use(attachUser);
  io.use(socketLogger);

  io.sockets.on('connection', function (socket) {
    console.log(`socket ${socket.id} connected; logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    // give them the list of rooms
    socket.emit(Protocol.UPDATE_ROOMS, Rooms);

    // Socket wants to join room.
    socket.on(Protocol.JOIN_ROOM, (accessCode, cb) => {
      // get room
      const room = getRoom({accessCode});
      if (!room) {
        socket.emit(Protocol.ERROR, {
          statusCode: 404,
          message: `Could not find room with accessCode ${accessCode}`
        });
        return;
      }

      socket.join(accessCode, () => {
        socket.room = room;
        if (socket.user) {
          room.addUser(socket.user);

          socket.emit(Protocol.JOIN, room); // tell the user they're cool and give them the info
          broadcast(Protocol.USER_JOIN, socket.user); // tell everyone
          
          if (room.doneWithScramble()) {
            console.log(104, 'everyone done, sending new scramble');
            sendNewScramble();
          }
        } else {
          socket.emit(Protocol.JOIN, room); // still give them the data
        }
      });
    });

    socket.on(Protocol.SUBMIT_RESULT, (result) => {
      // TODO: expand on handling errors
      if (!isLoggedIn() || !isInRoom()) {
        return;
      }

      if (!socket.room.attempts[result.id]) {
        socket.emit(Protocol.ERROR, {
          statusCode: 400,
          event: Protocol.SUBMIT_RESULT,
          message: 'Invalid ID for attempt submission',
        });
        return;
      }

      socket.room.attempts[result.id].results[socket.user.id] = result.result;
      broadcastToAllInRoom(Protocol.NEW_RESULT, {
        id: result.id,
        userId: socket.user.id,
        result: result.result,
      });

      if (socket.room.doneWithScramble()) {
        console.log(123, 'everyone done, sending new scramble');
        sendNewScramble();
      }
    });

    socket.on(Protocol.CREATE_ROOM, (options) => {
      if (!isLoggedIn()) {
        return;
      }

      const room = new Room({
        name: options.name,
        password: options.password,
        users: []
      });

      Rooms.push(room);

      io.emit(Protocol.ROOM_CREATED, room);
      socket.emit(Protocol.FORCE_JOIN, room);
      socket.join(room.accessCode, () => {
        socket.room = room;
        socket.emit(Protocol.JOIN, room);
      });
    });

    // Given ID, fetches room, authenticates, and returns room data.
    socket.on(Protocol.FETCH_ROOM, (id) => {
      const room = getRoom({id});

      if (!room) {
        socket.emit(Protocol.ERROR, {
          statusCode: 404,
          event: Protocol.FETCH_ROOM,
          message: `Could not find room with id ${id}`
        });
      } else {
        socket.emit(Protocol.UPDATE_ROOM, room);
      }
    });

    /* Admin Actions */
    socket.on(Protocol.DELETE_ROOM, id => {
      if (!checkAdmin()) {
        return;
      } else if (socket.room.id !== id) {
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.DELETE_ROOM,
          message: 'Must be admin of your own room',
        });
        return;
      }

      Rooms = Rooms.filter(room => room.id !== id);
      socket.room = undefined;
      broadcastToEveryone(Protocol.ROOM_DELETED, id);
    });

    socket.on(Protocol.REQUEST_SCRAMBLE, () => {
      if (!checkAdmin()) {
        return;
      }

      sendNewScramble();
    });

    socket.on(Protocol.DISCONNECT, () => {
      if (isInRoom()) {
        leaveRoom();
      }

      console.log(`socket ${socket.id} disconnected`)
    });

    socket.on(Protocol.LEAVE_ROOM, () => {
      if (socket.room) {
        leaveRoom();
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
          message: `Have be in a room`,
        });
      }
      return !!socket.room;
    }

    function leaveRoom () {
      if (socket.user) {
        broadcast(Protocol.USER_LEFT, socket.user.id);

        if (socket.room) {
          socket.room.users = socket.room.users.filter(i => i.id !== socket.user.id);

          if (socket.room.users.length > 0) {
            socket.room.admin = socket.room.users[0]; // pick new admin
            broadcastToAllInRoom(Protocol.UPDATE_ADMIN, socket.room.admin);
            
            if (socket.room.doneWithScramble()) {
              console.log(196, 'everyone done, sending new scramble');
              sendNewScramble();
            }
          }

          socket.room = undefined;
        }
      }
    }

    function sendNewScramble () {    
      broadcastToAllInRoom(Protocol.NEW_ATTEMPT, socket.room.newAttempt());
    }

    function broadcast () {
      socket.broadcast.to(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToAllInRoom () {
      io.in(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToEveryone () {
      io.emit(...arguments);
    }
  });

  return server;
}