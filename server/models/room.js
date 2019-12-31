const mongoose = require('mongoose');
const User = require('./user');

const Attempt = new mongoose.Schema({
  scramble: String,
  results: {}
});

module.exports = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  // For socket: namespace
  accessCode: String,
  private: Boolean,
  password: String,
  users: [User],
  attempts: [Attempt]
});