const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { generateScramble } = require('letscube-scrambles');
const { mirrorRoomChanges } = require('../postgres/dualWrite');

const PASSWORD_SALT_ROUNDS = 10;
const STALE_ROOM_LIFETIME_MS = 10 * 60 * 1000;

const sameUser = (left, right) => left && right
  && String(left.id) === String(right.id);

const selectRoomAdmin = ({ usersInRoom, owner, admin }) => {
  if (usersInRoom.length === 0) {
    return null;
  }

  const activeOwner = usersInRoom.find((user) => sameUser(user, owner));
  if (activeOwner) {
    return activeOwner;
  }

  return usersInRoom.find((user) => sameUser(user, admin)) || usersInRoom[0];
};

// const lengths = {

// };

const Result = new mongoose.Schema({
  time: {
    type: Number,
    required: true,
  },
  penalties: Object,
  submissionId: String,
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
  // Incremented for every join or departure so a conditional departure cannot
  // overwrite a reconnect that raced it on another Socket.IO process.
  membershipRevision: {
    type: Number,
    default: 0,
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
    this.expireAt = new Date(Date.now() + STALE_ROOM_LIFETIME_MS);
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
  this.membershipRevision = (this.membershipRevision || 0) + 1;

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
  this.membershipRevision = (this.membershipRevision || 0) + 1;

  await this.updateAdminIfNeeded(updateAdmin);

  if (this.usersInRoom.length === 0 && this.type === 'normal') {
    await this.updateStale(true);
  }

  return this.save();
};

Room.methods.dropUserAtomically = async function (user) {
  const userKey = user.id.toString();
  if (!this.inRoom.get(userKey)) {
    return null;
  }

  const usersInRoom = this.users.filter((candidate) => (
    candidate.id.toString() !== userKey
      && this.inRoom.get(candidate.id.toString())
  ));
  const nextAdmin = selectRoomAdmin({
    usersInRoom,
    owner: this.owner,
    admin: this.admin,
  });
  const adminChanged = !sameUser(this.admin, nextAdmin);
  const membershipRevision = this.membershipRevision || 0;
  const condition = {
    _id: this._id,
    [`inRoom.${userKey}`]: true,
  };
  if (this.updatedAt) {
    condition.updatedAt = this.updatedAt;
  }
  if (membershipRevision > 0) {
    condition.membershipRevision = membershipRevision;
  } else {
    condition.$or = [
      { membershipRevision: 0 },
      { membershipRevision: { $exists: false } },
    ];
  }

  const update = {
    $set: {
      [`inRoom.${userKey}`]: false,
      [`waitingFor.${userKey}`]: false,
      admin: nextAdmin ? nextAdmin._id || nextAdmin : null,
    },
    $inc: {
      membershipRevision: 1,
    },
  };
  if (usersInRoom.length === 0 && this.type === 'normal') {
    update.$set.expireAt = new Date(Date.now() + STALE_ROOM_LIFETIME_MS);
  }

  const updatedRoom = await this.constructor.findOneAndUpdate(condition, update, {
    new: true,
  }).populate('users').populate('admin').populate('owner');
  if (!updatedRoom) {
    return null;
  }

  await mirrorRoomChanges(updatedRoom, {
    attempts: [],
    participantUserIds: [userKey],
    syncAllParticipants: false,
    syncRoomOwners: adminChanged,
  });

  return { room: updatedRoom, adminChanged };
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

Room.methods.authenticate = async function (password) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(password, this.password);
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

Room.methods.genAttempt = async function () {
  return {
    id: this.attempts.length,
    scrambles: [await generateScramble(this.event)],
    results: {},
  };
};

Room.methods.newAttempt = async function () {
  const attempt = await this.genAttempt();

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

Room.methods.edit = async function (options) {
  // Older clients sent the room access code when the password field was unchanged.
  const legacyUnchangedPassword = !!this.password
    && options.password === this.accessCode;
  const replacesPassword = typeof options.password === 'string'
    && options.password.length > 0
    && !legacyUnchangedPassword;
  if (options.private && !replacesPassword && !this.password) {
    const error = new Error('A password is required to make a room private');
    error.statusCode = 400;
    throw error;
  }

  this.name = options.name;
  if (options.private) {
    if (replacesPassword) {
      this.password = await bcrypt.hash(options.password, PASSWORD_SALT_ROUNDS);
    }
  } else {
    this.password = null;
  }
  this.type = options.type;
  this.requireRevealedIdentity = options.requireRevealedIdentity;
  this.startTime = options.startTime;
  return this.save();
};

Room.methods.updateAdminIfNeeded = async function (cb) {
  const nextAdmin = selectRoomAdmin(this);
  if (sameUser(this.admin, nextAdmin) || (!this.admin && !nextAdmin)) {
    return this;
  }

  this.admin = nextAdmin;
  const room = await this.save();
  // UPDATE_ADMIN has always carried a user. Empty rooms persist null without
  // notifying clients that still expect a populated admin object.
  if (cb && room.admin) {
    cb(room);
  }
  return room;
};

const collectPostgresChanges = (room) => {
  const changesByAttempt = new Map();
  const participantUserIds = new Set();
  const ensureAttempt = (attemptIndex) => {
    if (!changesByAttempt.has(attemptIndex)) {
      changesByAttempt.set(attemptIndex, {
        attemptIndex,
        resultUserIds: new Set(),
        resultsMapModified: false,
        syncAllResults: false,
      });
    }
    return changesByAttempt.get(attemptIndex);
  };

  room.modifiedPaths({ includeChildren: true }).forEach((path) => {
    const participantMatch = path.match(
      /^(?:competing|waitingFor|banned|inRoom|registered)\.([^.]+)/,
    );
    if (participantMatch) {
      participantUserIds.add(participantMatch[1]);
    }

    const resultMatch = path.match(/^attempts\.(\d+)\.results(?:\.([^.]+))?/);
    if (resultMatch) {
      const change = ensureAttempt(Number(resultMatch[1]));
      if (resultMatch[2]) {
        change.resultUserIds.add(resultMatch[2]);
      } else {
        change.resultsMapModified = true;
      }
      return;
    }

    const attemptMatch = path.match(/^attempts\.(\d+)\.(?:id|scrambles)(?:\.|$)/);
    if (attemptMatch) {
      ensureAttempt(Number(attemptMatch[1]));
    }
  });

  (room.attempts || []).forEach((attempt, attemptIndex) => {
    if (attempt.isNew) {
      ensureAttempt(attemptIndex).syncAllResults = true;
    }
  });

  const attempts = [...changesByAttempt.values()].map((change) => ({
    attemptIndex: change.attemptIndex,
    resultUserIds: [...change.resultUserIds],
    syncAllResults: change.syncAllResults
      || (change.resultsMapModified && change.resultUserIds.size === 0),
  }));

  return {
    attempts,
    participantUserIds: [...participantUserIds],
    replaceAttempts: !room.isNew && room.isModified('event'),
    syncAllParticipants: room.isNew,
    syncRoomOwners: room.isNew || room.isModified('owner') || room.isModified('admin'),
  };
};

Room.pre('save', function capturePostgresChanges() {
  this.$locals.postgresChanges = collectPostgresChanges(this);
});

Room.post('save', async (room) => {
  // PostgreSQL failures are logged and swallowed by the migration-phase writer.
  await mirrorRoomChanges(room, room.$locals.postgresChanges);
});

module.exports.Attempt = Attempt;
module.exports.collectPostgresChanges = collectPostgresChanges;
module.exports.Room = Room;
module.exports.selectRoomAdmin = selectRoomAdmin;
