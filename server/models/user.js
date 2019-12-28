const mongoose = require('mongoose');

const schema = new mongoose.Schema({
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
}, {
  _id: false
});

module.exports = mongoose.model('User', schema, 'users');