const mongoose = require('mongoose');
const { FriendRelationship, RELATIONSHIP_STATUSES } = require('./friendRelationship');
const { Attempt, Room } = require('./room');
const { METRIC_EVENTS, MetricEvent } = require('./metricEvent');
const OutgoingRequestQuota = require('./outgoingRequestQuota');
const User = require('./user');
const UserBlock = require('./userBlock');

module.exports = {
  Room: mongoose.model('Room', Room, 'rooms'),
  User: mongoose.model('User', User, 'users'),
  FriendRelationship: mongoose.model(
    'FriendRelationship',
    FriendRelationship,
    'friend_relationships',
  ),
  UserBlock: mongoose.model('UserBlock', UserBlock, 'user_blocks'),
  OutgoingRequestQuota: mongoose.model(
    'OutgoingRequestQuota',
    OutgoingRequestQuota,
    'outgoing_request_quotas',
  ),
  Attempt: mongoose.model('Attempt', Attempt, 'attempts'),
  MetricEvent: mongoose.model('MetricEvent', MetricEvent, 'metric_events'),
  METRIC_EVENTS,
  RELATIONSHIP_STATUSES,
};
