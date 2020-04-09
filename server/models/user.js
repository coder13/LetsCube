const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  email: {
    type: String
  },
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
  },
  wcaId: {
    type: String
  },
  showWCAID: {
    type: Boolean,
    default: false,
  },
  preferUsername: {
    type: Boolean,
    default: false,
  },
  accessToken: {
    type: String,
    required: true
  },
  avatar: {
    type: Object
  }
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
      }
      delete ret.__v;
    },
  },
});

schema.virtual('displayName').get(function (v) {
  return this.preferUsername ? this.username : this.name; 
});

module.exports = schema;