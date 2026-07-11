const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const METRIC_EVENTS = Object.freeze({
  AUTH_FAILED: 'auth_failed',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_JOIN_FAILED: 'room_join_failed',
  ROOM_LEFT: 'room_left',
  ROOM_RESULT_SUBMITTED: 'room_result_submitted',
});

const MetricEvent = new mongoose.Schema({
  eventId: {
    type: String,
    default: uuidv4,
    required: true,
  },
  event: {
    type: String,
    enum: Object.values(METRIC_EVENTS),
    required: true,
    index: true,
  },
  actorId: {
    type: String,
    index: true,
  },
  actorType: {
    type: String,
    enum: ['authenticated', 'anonymous'],
  },
  roomId: {
    type: String,
    index: true,
  },
  roomType: {
    type: String,
    enum: ['normal', 'grand_prix'],
  },
  cubeEvent: String,
  privateRoom: Boolean,
  failureReason: String,
  leaveReason: {
    type: String,
    enum: ['disconnect', 'explicit', 'kick', 'ban'],
  },
  activeUserCount: {
    type: Number,
    min: 0,
  },
  roomSolveCount: {
    type: Number,
    min: 0,
  },
  durationMs: {
    type: Number,
    min: 0,
  },
  active: {
    type: Boolean,
    default: false,
  },
  closedAt: Date,
  occurredAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  versionKey: false,
});

MetricEvent.index({
  expiresAt: 1,
}, {
  expireAfterSeconds: 0,
});

MetricEvent.index({
  eventId: 1,
}, {
  unique: true,
  partialFilterExpression: {
    eventId: { $type: 'string' },
  },
});

// Prevent multiple browser tabs from opening overlapping visits for one user.
MetricEvent.index({
  actorId: 1,
  roomId: 1,
  event: 1,
}, {
  unique: true,
  partialFilterExpression: {
    event: METRIC_EVENTS.ROOM_JOINED,
    active: true,
    actorId: { $type: 'string' },
    roomId: { $type: 'string' },
  },
});

module.exports = {
  METRIC_EVENTS,
  MetricEvent,
};
