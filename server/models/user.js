const mongoose = require('mongoose');

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
  accessToken: {
    type: String,
    required: true,
  },
  avatar: {
    type: Object,
  },
}, {
  _id: true,
  versionKey: false,
  toJSON: {
    getters: true,
    transform(doc, ret) {
      delete ret.email;
      delete ret.accessToken;
      if (!doc.showWCAID) {
        delete ret.wcaId;
        delete ret.name;
      }

      delete ret.showWCAID;
      delete ret.__v;
    },
  },
  toObject: {
    getters: true,
  },
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

module.exports = schema;
