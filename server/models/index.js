const mongoose = require('mongoose');
const { Attempt, Room } = require('./room');
const Solve = require('./solve');
const User = require('./user');

module.exports = {
  Room: mongoose.model('Room', Room, 'rooms'),
  User: mongoose.model('User', User, 'users'),
  Attempt: mongoose.model('Attempt', Attempt, 'attempts'),
  Solve: mongoose.model('Solve', Solve, 'solves'),
};
