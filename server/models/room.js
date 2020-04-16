const mongoose = require('mongoose');
const moment = require('moment');
const { Scrambow } = require('scrambow');
const bcrypt = require('bcrypt');
const User = require('./user');
const uuidv4 = require('uuid/v4');

// const lengths = {
  
// };

const Result = new mongoose.Schema({
 time: {
   type: Number,
   required: true,
 },
 penalties: Object,
}, {
 timestamps: true,
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
  timestamps: true,
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
    default: uuidv4,
  },
  password: String,
  attempts: {
    type: [Attempt],
    default: [],
  },
  users: [User],
  admin: User,
  expireAt: {
    type: Date,
    default: undefined,
  }
}, {
  timestamps: true,
});

Room.index({
  "expireAt": 1,
}, {
  expireAfterSeconds: 0,
});

Room.virtual('scrambler').get(function () {
  return new Scrambow().setType(this.event);
});

Room.virtual('usersLength').get(function () {
  return this.users.length;
})

Room.virtual('private').get(function () {
  return !!this.password;
});

Room.methods.updateStale = function(stale) {
  if (stale) {
    this.expireAt = moment().add(10, 'minutes')
  } else {
    this.expireAt = null;
  }

  return this.save();
}

Room.methods.addUser = async function(user, updateAdmin) {
  if (this.users.find(i => i.id === user.id)) {
    return false;
  }

  this.users.push(user);
  await this.updateStale(false);
  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  return this.save();
}

Room.methods.dropUser = async function(user, updateAdmin) {
  this.users = this.users.filter(i => i.id !== user.id);
  await this.save();

  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  if (this.users.length === 0) {
    await this.updateStale(true);
  }

  return this.save();
}

Room.set('toJSON', {
  virtuals: true
});

Room.methods.authenticate = function (password) {
  if (!this.password) {
    console.error('No password given');
    return false;
  }

  return bcrypt.compareSync(password, this.password);
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
    scrambles: this.scrambler.get(1).map(i => i.scramble_string),
    results: {},
  };
}

Room.methods.newAttempt = function (cb) {
  const attempt = this.genAttempt();

  this.attempts = this.attempts.concat([attempt]);
  this.save().then(() => {
    cb(attempt);
  }).catch(console.error);
}

Room.methods.changeEvent = function (event) {
  this.event = event;
  this.attempts = [];
  this.attempts.push(this.genAttempt());
  return this.save();
}

Room.methods.updateAdminIfNeeded = function (cb) {
  if (this.users.length === 0) {
    this.admin = null;
    return this.save();
  }
  
  if (!this.admin || this.admin.id !== this.users[0].id) {
    this.admin = this.users[0];
    return this.save().then(cb);
  }
}

module.exports.Attempt = Attempt;
module.exports.Room = Room;