const path = require('path');
const http = require('http');
const express = require('express');
const config = require('getconfig');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const expressSocketSession = require('express-socket.io-session');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const { NotFound } = require('rest-api-errors');
const bcrypt = require('bcrypt');
const uuidv1 = require('uuid/v1');
const socketLogger = require('./middlewares/socketLogger');
const Scrambo = require('scrambo');
const Protocol = require('../app/lib/protocol.js');
const { User } = require('./models');

Error.stackTraceLimit = 100;

class Room {
  constructor (options) {
    this.id = options.id || uuidv1();
    this.name = options.name;
    this.event = options.event || '333';
    this.scrambler = new Scrambo().type(this.event);
    this.accessCode = uuidv1(); // unique ID to use for rooms; #SecurityThroughObscurity
    this.private = !!options.password; // determine if room is private based on if password is defined

    if (options.password) {
      this.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
    }

    this.users = options.users || [];
    this.attempts = [];
  }

  addUser (user) {
    this.users.push(user);
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
    const attempt = {
      id: this.attempts.length,
      scrambles: this.scrambler.get(1),
      results: {},
    };

    this.attempts.push(attempt);
    return attempt;
  }
}

const Rooms = [];

Rooms.push(new Room({
  id: '62a53540-6f81-11ea-af07-c1038094a32d',
  name: 'Default',
  password: false,
}))

const getRoom = (options) => Rooms.find(i => options.id ? i.id === options.id : i.accessCode === options.accessCode);

function initSocket (app, io) {
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
      if (socket.room && socket.room.attempts[result.id]) {
        socket.room.attempts[result.id].results[socket.user.id] = result.result;
        broadcastToAll(Protocol.NEW_RESULT, {
          id: result.id,
          userId: socket.user.id,
          result: result.result,
        });

        console.log(122, socket.room)
        if (socket.room.doneWithScramble()) {
          console.log(123, 'everyone done, sending new scramble');
          sendNewScramble();
        }
      }
    });

    socket.on(Protocol.CREATE_ROOM, (options) => {
      if (!socket.user) {
        // TODO: expand on handling errors
        socket.emit(Protocol.ERROR, {
          statusCode: 403,
          event: Protocol.CREATE_ROOM,
          message: 'Must be logged in to create room',
        });
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
    socket.on(Protocol.FETCH_ROOM, id => {
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

    socket.on(Protocol.DISCONNECT, () => {
      if (socket.room) {
        leaveRoom();
      } else {
        console.log(97, 'socket has no room')
      }
      console.log(`socket ${socket.id} disconnected`)
    });

    socket.on(Protocol.LEAVE_ROOM, () => {
      if (socket.room) {
        leaveRoom();
      }
    });

    function leaveRoom () {
      if (socket.user) {
        broadcast(Protocol.USER_LEFT, socket.user.id);

        if (socket.room) {
          socket.room.users = socket.room.users.filter(i => i.id !== socket.user.id);
          if (socket.room.doneWithScramble()) {
            console.log(196, 'everyone done, sending new scramble');
            sendNewScramble();
          }
        }
      }
    }

    function sendNewScramble () {
      const attempt = socket.room.newAttempt();
    
      console.log(Protocol.NEW_ATTEMPT, attempt)
      broadcastToAll(Protocol.NEW_ATTEMPT, attempt);
    }

    function broadcast (event, data) {
      socket.broadcast.to(socket.room.accessCode).emit(...arguments);
    }

    function broadcastToAll (event, data) {
      io.in(socket.room.accessCode).emit(...arguments);
    }

    function emit (event, data) {
      socket.to(socket.room.accessCode).emit(...arguments);
    }
  });
}

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV === 'prod');
  
  app.use(express.json()); // for parsing application/json
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  console.log('Attempting to connect to mongodb at:', config.mongodb);
  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log(`Connected to mongo database at ${config.mongodb}`);
  }).catch(err => {
    console.error('Error when connecting to database', err);
    process.exit();
  });

  /* Logging */

  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
    stream: process.stdout
  }));

  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode >= 400,
    stream: process.stderr
  }));

  /* Auth */

  // console.log(config.auth.secret)
  // let cookieAuth = cookieSession({
  //   name: 'session',
  //   secret: config.auth.secret || 'prod-secret',
  //   signed: false,
  // });

  const sessionOptions = {
    secret: config.auth.secret,
    saveUninitialized: false, // don't create session until something stored
    resave: false, // don't save session if unmodified,
    cookie: {
      httpOnly: true,
      secure: app.get('prod'),
      sameSite: app.get('prod') ? 'strict' : false,
    },
    store: new MongoStore({
      mongooseConnection:  mongoose.connection,
    }),
  };

  if (app.get('prod')) {
    app.set('trust proxy', 1) // trust first proxy
    sessionOptions.cookie.secure = true // serve secure cookies
  }

  const expressSession = session(sessionOptions)
  
  // app.use(cookieAuth);
  app.use(expressSession);
  
  app.use(passport.initialize());
  app.use(passport.session());

  const socketServer = http.Server(app);
  const io = app.io = require('socket.io')(socketServer);
  /* socket.handshake.session.passport.user */
  io.use(expressSocketSession(expressSession, {
    autoSave: true
  }));
  
  io.use((socket, next) => {
    console.log(287, socket.handshake.session);
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
  });

  io.use(socketLogger);

  socketServer.listen(9000);

  initSocket(app, io);

  /* Cors */

  app.use(cors({
    origin: '*',
    credentials: true
  }))

  app.use(express.static(path.join(__dirname, '../build')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });

  app.use('/auth', require('./auth')(app, passport));
  app.use('/api', require('./routes')(app));

  app.use('/*', () => {
    throw new NotFound();
  });

  const server = app.listen(config.server.port, '0.0.0.0', (err) => {
    if (err) {
      console.log(err);
    }

    console.log(`Listening on port ${config.server.port}. Access at: http://localhost:${config.server.port}/`);
  });  
};

init().catch(err => {
  console.error(err);
});
