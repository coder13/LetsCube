const mongoose = require('mongoose');
const { mirrorUser } = require('../postgres/dualWrite');
const { normalizeUsername } = require('../username');

const redactUser = (doc, ret) => {
  delete ret.email;
  delete ret.accessToken;
  delete ret.usernameNormalized;
  if (!doc.showWCAID) {
    delete ret.wcaId;
    if (!doc.preferRealName) {
      delete ret.name;
    }
    ret.avatar = {};
  }

  delete ret.__v;
};

const schema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
  },
  usernameNormalized: {
    type: String,
  },
  wcaId: {
    type: String,
  },
  showWCAID: {
    type: Boolean,
    default: false,
  },
  preferRealName: {
    type: Boolean,
    default: false,
  },
  useInspection: {
    type: Boolean,
    default: false,
  },
  timerType: {
    type: String,
    default: 'spacebar',
  },
  accessToken: {
    type: String,
    required: true,
  },
  avatar: {
    type: Object,
  },
  muteTimer: {
    type: Boolean,
    default: false,
  },
}, {
  _id: true,
  versionKey: false,
  toJSON: {
    getters: true,
    transform: redactUser,
  },
  toObject: {
    getters: true,
    transform: redactUser,
  },
  autoIndex: false,
});

schema.index(
  { usernameNormalized: 1 },
  { name: 'users_username_normalized_unique', sparse: true, unique: true },
);

schema.pre('validate', function normalizeChangedUsername(next) {
  if (!this.isNew && !this.isModified('username')) {
    return next();
  }

  try {
    const normalized = normalizeUsername(this.username);
    this.username = normalized.username;
    this.usernameNormalized = normalized.usernameNormalized;
    return next();
  } catch (err) {
    return next(err);
  }
});

schema.virtual('displayName').get(function () {
  return !this.preferRealName ? this.username : this.name;
});

// A user can only join a room if they have checked the new
// `Prefer real name to username` which is inverse of preferUsername
// If they haven't preferred real name to username, their username has to be set
schema.virtual('canJoinRoom').get(function () {
  return this.preferRealName || !!this.username;
});

const dualWriteUser = (user) => {
  // PostgreSQL is a non-blocking secondary during the dual-write phase.
  mirrorUser(user);
};

schema.post('save', dualWriteUser);
schema.post('findOneAndUpdate', dualWriteUser);

module.exports = schema;
