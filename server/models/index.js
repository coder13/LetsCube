const mongoose = require('mongoose');
const { Attempt, Room } = require('./room');
const { METRIC_EVENTS, MetricEvent } = require('./metricEvent');
const User = require('./user');

module.exports = {
  Room: mongoose.model('Room', Room, 'rooms'),
  User: mongoose.model('User', User, 'users'),
  Attempt: mongoose.model('Attempt', Attempt, 'attempts'),
  MetricEvent: mongoose.model('MetricEvent', MetricEvent, 'metric_events'),
  METRIC_EVENTS,
};
