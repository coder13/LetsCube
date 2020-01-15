const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const uuidv1 = require('uuid/v1');
const { User, Room } = require('./models');
const auth = require('./middlewares/auth.js')

module.exports = (app) => {
  const sendError = (res) => (err) => {
    res.status(500).send({
      message: err.message || 'Error occured while retrieving data; contact Kleb'
    });
  };

  /*
    Returns array of:
      {
        name,
        id,
        accessCode
      } 
  */
  let rooms = [{
    name: 'foo', 
    id: 1,
    accessCode: 'asdsad',
    users: [1,2,3,4,5],
    private: false
  }, {
    name: 'bar', 
    id: 2,
    accessCode: 'asd12asdsd',
    users: [1,2,3,4,5,6,7,8],
    private: true
  }]
  router.get('/rooms', (req, res) => {
    Room.find()
      .then(rooms => {
        res.send(rooms)
      }).catch(sendError(res))
  });

  /*
    Returns basic data about a room for new page refresh on
    Returns {
      name,
      password
    }
  */
  router.get('/rooms/:roomId', (req, res) => {
    Room.findById(req.params.roomId, (err, room) => {
      if (err) {
        return sendError(res)(err);
      }

      return res.send(room);
    });
  })

  /*
    Creates room
    Only authenticated users can create rooms
    Body 
  */
  router.post('/rooms', auth, (req, res) => {
    const newRoom = new Room({
      name: req.body.name,
      accessCode: uuidv1(),
      private: !!req.body.password,
      users: [req.user]
    });

    if (req.body.password) {
      newRoom.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(5));
    }

    newRoom.save()
      .then(room => {
        app.createRoom(room);
        res.send(room);
      })
      .catch(sendError(res))
  });

  /*
    Attempts to join user to room
    Body: {
      password
    }
  */
  router.post('/rooms/:roomId/', (req, res) => {
    Room.findById(req.params.roomId, (err, room) => {
      if (err) {
        return res.status(500).send({})
      }

      if (req.body.password === room.password) {
        res.send(room);
      }
    })
  });

  return router;
}