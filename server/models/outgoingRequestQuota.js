const mongoose = require('mongoose');

const Reservation = new mongoose.Schema({
  pairKey: {
    type: String,
    required: true,
  },
  reservedAt: {
    type: Date,
    required: true,
  },
}, {
  _id: false,
});

const OutgoingRequestQuota = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },
  reservations: {
    type: [Reservation],
    default: [],
  },
  revision: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

OutgoingRequestQuota.index({ userId: 1 }, { unique: true });

module.exports = OutgoingRequestQuota;
