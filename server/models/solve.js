const mongoose = require('mongoose');

const Result = new mongoose.Schema({
  time: {
    type: Number,
    required: true,
  },
  penalties: Object,
}, {
  _id: false,
  timestamps: true,
});

const RoomSnapshot = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  event: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
}, {
  _id: false,
});

const Solve = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  roomSnapshot: {
    type: RoomSnapshot,
    required: true,
  },
  attemptId: {
    type: Number,
    required: true,
  },
  attempt: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  scrambles: {
    type: [String],
    required: true,
  },
  userId: {
    type: Number,
    required: true,
  },
  result: {
    type: Result,
    required: true,
  },
  editedBy: {
    type: Number,
  },
}, {
  timestamps: true,
});

Solve.index({
  room: 1,
  attemptId: 1,
  userId: 1,
}, {
  unique: true,
});

Solve.index({
  userId: 1,
  createdAt: -1,
});

Solve.index({
  'roomSnapshot.event': 1,
  createdAt: -1,
});

module.exports = Solve;
