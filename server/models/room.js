const mongoose = require('mongoose');
const Scrambo = require('scrambo');
const User = require('./user');
const uuidv4 = require('uuid/v4');

const Result = new mongoose.Schema({
 time: {
   type: Number,
   required: true,
 }
});

const Attempt = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  scrambles: {
    type: [String],
    required: true,
  },
  results: {
    type: Map,
    of: Result,
    default: {}
  }
}, {
  minimize: false,
});

const Room = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  event: { // TODO: change to eventId
    type: String,
    default: '333',
  },
  // For socket: namespace
  accessCode: {
    type: String,
    default: uuidv4(),
  },
  private: {
    type: Boolean,
    required: true,
  },
  password: String,
  attempts: {
    type: [Attempt],
    default: [],
  },
  admin: User,
});

Room.virtual('id').get(function() {
  return this._id.toHexString();
});

Room.virtual('scrambler').get(function () {
  return new Scrambo(this.event);
});

Room.virtual('users').get(function () {
  if (!this._users) {
    this._users = [];
  }

  return this._users;
});

Room.set('toJSON', {
  virtuals: true
});

Room.methods.addUser = function (user) {
  this._users.push(user);
  if (this._users.length === 1) {
    this.admin = user;
    return this.save();
  }
  return false;
}

Room.methods.doneWithScramble = function () {
  if (this.users.length === 0) {
    return false;
  }
  
  if (this.attempts.length === 0) {
    return 'first'
  } else {
    // check that for every user, there exists a result.
    const latest = this.attempts[this.attempts.length - 1];
    return this.users.every(user => latest.results.get(user.id.toString()));
  }
}

Room.methods.genAttempt = function () {
  return {
    id: this.attempts.length,
    scrambles: this.scrambler.get(1),
    results: {},
  };
}

Room.methods.newAttempt = function (cb) {
  const attempt = this.genAttempt();

  this.attempts.push(attempt);
  this.save().then(() => {
    cb(attempt);
  }).catch(console.error);
}

module.exports.Attempt = Attempt;
module.exports.Room = Room;