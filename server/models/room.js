const mongoose = require('mongoose');
const moment = require('moment');
const { Scrambow } = require('scrambow');
const bcrypt = require('bcrypt');
const uuidv4 = require('uuid/v4');
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
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // userIds waiting for till next round.
  waitingFor: {
    type: Map,
    of: Boolean,
    default: {},
  },
  competing: {
    type: Map,
    of: Boolean,
    default: {},
  },
  banned: {
    type: Map,
    of: Boolean,
    default: {},
  },
  inRoom: {
    type: Map,
    of: Boolean,
    default: {},
  },
  registered: {
    type: Map,
    of: Boolean,
    default: {},
  },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['normal', 'grand_prix'],
    default: 'normal',
  },
  requireRevealedIdentity: {
    type: Boolean,
    default: false,
  },
  startTime: {
    type: Date,
  },
  started: {
    type: Boolean,
    default: false,
  },
  nextSolveAt: {
    type: Date,
  },
  expireAt: {
    type: Date,
    default: undefined,
  },
  twitchChannel: {
    type: String,
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

Room.virtual('waitingForCount').get(function () {
  return [...this.waitingFor.values()].filter((i) => i).length;
});

Room.virtual('latestAttempt').get(function () {
  return this.attempts[this.attempts.length - 1];
});

Room.methods.start = function () {
  this.started = true;

  this.users.forEach((user) => {
    if (this.registered.get(user.id.toString())) {
      this.competing.set(user.id.toString(), true);
    }
  });

  return this.save();
};

Room.methods.pause = function () {
  this.started = false;
  this.nextSolveAt = null;
  return this.save();
};

Room.methods.updateStale = function updateStale(stale) {
  if (stale) {
    this.expireAt = moment().add(10, 'minutes');
  } else {
    this.expireAt = null;
  }

  return this.save();
};

Room.methods.addUser = async function (user, spectating, updateAdmin) {
  if (this.inRoom.get(user.id.toString())) {
    return false;
  }

  if (!this.users.find((i) => i.id === user.id)) {
    this.users.push(user);
    this.competing.set(user.id.toString(), this.type === 'normal');
  } else if (spectating) {
    this.competing.set(user.id.toString(), false);
  }

  this.inRoom.set(user.id.toString(), true);

  if (this.waitingForCount === 0) {
    this.waitingFor.set(user.id.toString(), true);
  }

  if (this.type !== 'grand_prix'
    && (this.attempts.length === 0
      || [...this.latestAttempt.results.keys()].length > 0)) {
    this.waitingFor.set(user.id.toString(), true);
    await this.newAttempt();
  }

  await this.updateStale(false);
  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  return this.save();
};

Room.methods.dropUser = async function (user, updateAdmin) {
  this.inRoom.set(user.id.toString(), false);
  this.waitingFor.set(user.id.toString(), false);

  if (updateAdmin) {
    await this.updateAdminIfNeeded(updateAdmin);
  }

  if (this.usersInRoom.length === 0 && this.type === 'normal') {
    await this.updateStale(true);
  }

  return this.save();
};

Room.methods.banUser = async function (userId) {
  this.banned.set(userId.toString(), true);
  return this.dropUser({ id: userId });
};

Room.methods.unbanUser = async function (userId) {
  this.banned.set(userId.toString(), false);
  return this.save();
};

Room.methods.updateRegistration = async function (userId, registration) {
  this.registered.set(userId.toString(), registration);
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
  if (this.type === 'grand_prix') {
    return false;
  }

  if (this.usersInRoom.filter((user) => (
    this.latestAttempt.results.get(user.id.toString())
  )).length === 0) {
    return false;
  }

  return (this.waitingForCount === 0 || this.attempts.length === 0) && this.usersInRoom.length > 0;
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

  this.usersInRoom.forEach((user) => {
    this.waitingFor.set(user.id.toString(), this.competing.get(user.id.toString()));
  });

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
  this.type = options.type;
  this.requireRevealedIdentity = options.requireRevealedIdentity;
  this.startTime = options.startTime;
  return this.save();
};

Room.methods.updateAdminIfNeeded = function (cb) {
  if (this.usersInRoom.length === 0) {
    this.admin = null;
    return this.save();
  }

  const findOwner = this.usersInRoom.find((user) => user.id === this.owner.id);
  if (findOwner && this.admin && this.admin.id !== findOwner.id) {
    this.admin = findOwner;
    return this.save().then(cb);
  }

  if (!this.admin || this.admin.id !== this.usersInRoom[0].id) {
    const { usersInRoom } = this;

    // eslint-disable-next-line prefer-destructuring
    this.admin = usersInRoom[0];
    return this.save().then(cb);
  }
};

module.exports.Attempt = Attempt;
module.exports.Room = Room;
