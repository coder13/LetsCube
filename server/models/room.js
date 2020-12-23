const mongoose = require('mongoose');
const moment = require('moment');
const { Scrambow } = require('scrambow');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');
const User = require('./user');
const { Events } = require('../../client/src/lib/events');

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
    default: {},
  },
}, {
  minimize: false,
  timestamps: true,
});

const Room = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  // userIds waiting for till next round.
  waitingFor: {
    type: [Number],
    default: [],
  },
  competing: {
    type: Map,
    of: Boolean,
    default: {},
  },
  inRoom: {
    type: Map,
    of: Boolean,
    default: {},
  },
  admin: User,
  owner: User,
  type: {
    type: String,
    enum: ['normal', 'grand_prix'],
    default: 'normal',
  },
  expireAt: {
    type: Date,
    default: undefined,
  },
}, {
  timestamps: true,
});

Room.index({
  expireAt: 1,
}, {
  expireAfterSeconds: 0,
});

Room.virtual('scrambler').get(function () {
  return new Scrambow().setType(Events.find((e) => e.id === this.event).scrambler);
});

Room.virtual('usersInRoom').get(function () {
  return this.users.filter(({ id }) => this.inRoom.get(id.toString()));
});

Room.virtual('usersLength').get(function () {
  return this.usersInRoom.length;
});

Room.virtual('private').get(function () {
  return !!this.password;
});

Room.methods.updateStale = function updateStale(stale) {
  if (stale) {
    this.expireAt = moment().add(10, 'minutes');
  } else {
    this.expireAt = null;
  }

  return this.save();
};

Room.methods.addUser = async function (user, updateAdmin) {
  if (this.inRoom.get(user.id.toString())) {
    return false;
  }

  if (!this.users.find((i) => i.id === user.id)) {
    this.users.push(user);
    this.competing.set(user.id.toString(), true);
  }

  this.inRoom.set(user.id.toString(), true);

  if (this.waitingFor.length === 0) {
    this.waitingFor.push(user.id);
  }

  await this.updateStale(false);
  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  return this.save();
};

Room.methods.dropUser = async function (user, updateAdmin) {
  // this.users = this.users.filter((i) => i.id !== user.id);
  this.inRoom.set(user.id.toString(), false);
  this.waitingFor.splice(this.waitingFor.indexOf(user.id), 1);

  await this.save();

  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  if (this.users.length === 0) {
    await this.updateStale(true);
  }

  return this.save();
};

Room.set('toJSON', {
  virtuals: true,
});

Room.methods.authenticate = function (password) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compareSync(password, this.password);
};

Room.methods.doneWithScramble = function () {
  if (this.users.filter((user) => this.attempts[this.attempts.length - 1].results
    .get(user.id.toString())).length === 0) {
    return false;
  }

  return (this.waitingFor.length === 0 || this.attempts.length === 0) && this.users.length > 0;
};

Room.methods.genAttempt = function () {
  return {
    id: this.attempts.length,
    scrambles: this.scrambler.get(1).map((i) => i.scramble_string),
    results: {},
  };
};

Room.methods.newAttempt = function () {
  const attempt = this.genAttempt();

  this.attempts = this.attempts.concat([attempt]);

  this.waitingFor = this.users
    .filter(({ id }) => this.competing.get(id.toString()) && this.inRoom.get(id.toString()))
    .map(({ id }) => +id);

  return this.save();
};

Room.methods.changeEvent = function (event) {
  this.event = event;
  this.attempts = [];
  return this.newAttempt();
};

Room.methods.edit = function (options) {
  this.name = options.name;
  if (options.private) {
    this.password = bcrypt.hashSync(options.password, bcrypt.genSaltSync(5));
  } else {
    this.password = null;
  }
  return this.save();
};

Room.methods.updateAdminIfNeeded = function (cb) {
  if (this.users.length === 0) {
    this.admin = null;
    return this.save();
  }

  const findOwner = this.users.find((user) => user.id === this.owner.id);
  if (findOwner && this.admin && this.admin.id !== findOwner.id) {
    this.admin = findOwner;
    return this.save().then(cb);
  }

  if (!this.admin || this.admin.id !== this.users[0].id) {
    const { users } = this;

    // eslint-disable-next-line prefer-destructuring
    this.admin = users[0];
    return this.save().then(cb);
  }
};

module.exports.Attempt = Attempt;
module.exports.Room = Room;
