const mongoose = require('mongoose');
const { mirrorUser } = require('../postgres/dualWrite');

const redactUser = (doc, ret) => {
  delete ret.email;
  delete ret.accessToken;
  delete ret.anonymizedAt;
  delete ret.anonymizedBy;
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
  email: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  username: {
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
  },
  avatar: {
    type: Object,
  },
  anonymizedAt: {
    type: Date,
  },
  anonymizedBy: {
    type: Number,
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
});

schema.virtual('displayName').get(function () {
  if (this.anonymizedAt) {
    return this.username || 'Anonymous User';
  }
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
