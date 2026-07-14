const mongoose = require('mongoose');
const { FriendRelationship, RELATIONSHIP_STATUSES } = require('./friendRelationship');
const { Attempt, Room } = require('./room');
const { METRIC_EVENTS, MetricEvent } = require('./metricEvent');
const SocialNotification = require('./socialNotification');
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
  Attempt: mongoose.model('Attempt', Attempt, 'attempts'),
  MetricEvent: mongoose.model('MetricEvent', MetricEvent, 'metric_events'),
  SocialNotification: mongoose.model('SocialNotification', SocialNotification, 'social_notifications'),
  METRIC_EVENTS,
  RELATIONSHIP_STATUSES,
};
