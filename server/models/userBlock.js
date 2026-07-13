const mongoose = require('mongoose');

const UserBlock = new mongoose.Schema({
  pairKey: {
    type: String,
    required: true,
    index: true,
  },
  blockerId: {
    type: Number,
    required: true,
  },
  blockedId: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

UserBlock.index({ blockerId: 1, blockedId: 1 }, { unique: true });
UserBlock.index({ blockedId: 1 });

UserBlock.pre('validate', function validateBlock(next) {
  if (this.blockerId === this.blockedId) {
    next(new Error('Users cannot block themselves'));
    return;
  }
  const lowUserId = Math.min(this.blockerId, this.blockedId);
  const highUserId = Math.max(this.blockerId, this.blockedId);
  if (this.pairKey !== `${lowUserId}:${highUserId}`) {
    next(new Error('User block pair key does not match its users'));
    return;
  }
  next();
});

module.exports = UserBlock;
