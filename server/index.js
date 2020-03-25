const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const config = require('getconfig');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const expressSocketSession = require('express-socket.io-session');
const cookieSession = require('cookie-session');
const MongoStore = require('connect-mongo')(session);
const { NotFound } = require('rest-api-errors');
const bcrypt = require('bcrypt');
const uuidv1 = require('uuid/v1');
const socketLogger = require('./middlewares/socketLogger');
const Protocol = require('../app/lib/protocol.js');
const { Room, User } = require('./models');

function initSocket (app, io) {
  io.sockets.on('connection', function (socket) {
    console.log(`socket ${socket.id} connected logged in as ${socket.user ? socket.user.name : 'Anonymous'}`);

    // give them the list of rooms
    Room.find().then(rooms => {
      socket.emit(Protocol.UPDATE_ROOMS, rooms);
    });

    socket.on(Protocol.JOIN_ROOM, (accessCode, cb) => {
      Room.findOne({accessCode}).then(room => {
        if (room) {
          socket.join(accessCode, () => {
            if (socket.user) {
              room.users.push(socket.user);
              room.save().then(r => {
                socket.room = room;
                socket.emit(Protocol.JOIN, room);
                broadcast(Protocol.USER_JOIN, socket.user);
              });
            }
          });
        } else {
          console.log(47, 'room unable to be found with accessCode ', accessCode);
        }
      });
    });

    socket.on(Protocol.CREATE_ROOM, (room) => {
      if (!socket.user) {
        // TODO: expand on handling errors
        socket.emit(Protocol.ERROR, {
          event: Protocol.CREATE_ROOM,
          message: 'Must be logged in to create room',
        });
        return;
      }

      const newRoom = new Room({
        name: room.name,
        accessCode: uuidv1(), // unique ID to use for rooms; #SecurityThroughObscurity
        private: !!room.password, // determine if room is private based on if password is defined
        users: [socket.user]
      });

      if (room.password) {
        newRoom.password = bcrypt.hashSync(room.password, bcrypt.genSaltSync(5));
      }

      newRoom.save()
        .then(room => {
          io.emit(Protocol.ROOM_CREATED, room);
          socket.emit(Protocol.FORCE_JOIN, room.id);
          socket.join(room.accessCode, () => {
            socket.room = room;
            socket.emit(Protocol.JOIN, room);
          });
        })
        .catch(err => {
          console.error(err);
        });
    });

    socket.on(Protocol.FETCH_ROOM, id => {
      Room.findById(id).then(room => {
        socket.emit(Protocol.UPDATE_ROOM, room);
      });
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
      const { room, user } = socket;
      if (user) {
        Room.update({ _id: room._id }, {
          '$pull': {
            users: {
              id: user.id
            }
          }
        }, {
          safe: true,
          multi:true
        }, function(err, obj) {
          broadcast(Protocol.USER_LEFT, user.id);
        });
      }
    }

    function broadcast (event, data) {
      socket.broadcast.to(socket.room.accessCode).emit(...arguments);
    }
  });
}

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV !== 'prod');
  
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

  let cookieAuth = cookieSession({
    name: 'session',
    secret: config.auth.secret,
    signed: false
  });

  app.use(cookieAuth);

  app.use(passport.initialize());
  app.use(passport.session());

  const socketServer = http.Server(app);
  const io = app.io = require('socket.io')(socketServer);
  /* socket.handshake.session.passport.user */
  io.use(expressSocketSession(cookieAuth, {
    autoSave: true
  }));
  io.use((socket, next) => {
    const userId = socket.handshake.session.passport ? socket.handshake.session.passport.user : null;

    if (!userId) {
      next();
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
    origin: 'http://localhost:3000',
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