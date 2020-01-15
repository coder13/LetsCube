const mongoose = require('mongoose');

module.exports = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  email: {
    type: String
  },
  name: {
    type: String,
    required: true
  },
  wcaId: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  avatar: {
    type: Object
  }
}, {
  _id: false
});