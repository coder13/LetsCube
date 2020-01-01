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
const cookieSession = require('cookie-session');
const MongoStore = require('connect-mongo')(session);
const { NotFound } = require('rest-api-errors');
const { UPDATE_ROOMS } = require('../app/lib/protocol.js');
const { Room } = require('./models');

const init = async () => {
  const app = express();

  app.set('config', config);
  app.set('prod', process.env.NODE_ENV !== 'prod');
  
  app.use(express.json()); // for parsing application/json
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
  });

  const socketServer = http.Server(app);
  const io = app.io = require('socket.io')(socketServer);
  socketServer.listen(9000);

  io.sockets.on('connection', function (socket){
    Room.find().then(rooms => {
        socket.emit(UPDATE_ROOMS, rooms)
      });

    socket.on('disconnect', function () {
      console.log(27, 'socket disconnected')
    })
  });

  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }))

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

  app.use(cookieSession({
    name: 'session',
    secret: config.auth.secret,
    signed: false
  }))

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.static(path.join(__dirname, '../build')))

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });

  app.use('/auth', require('./auth')(app, passport));
  app.use('/api', require('./routes')(app));

  app.use('/*', () => {
    throw new NotFound();
  });

  await mongoose.connect(config.mongodb, {
    useNewUrlParser: true
  }).then(() => {
    console.log(`Connected to mongo database at ${config.mongodb}`);
  }).catch(err => {
    console.error('Error when connecting to database', err);
    process.exit();
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
})