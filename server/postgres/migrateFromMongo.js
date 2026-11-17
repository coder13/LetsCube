// One-time cutover tool. It is intentionally kept separate from the runtime:
// production processes never load the MongoDB connection or models.
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const database = require('../database');
const { initializePostgres, pool } = require('./index');
const {
  mirrorBlock,
  mirrorMetricEvent,
  mirrorNotification,
  mirrorRelationship,
  mirrorRoom,
  mirrorUser,
} = require('./dualWrite');
const {
  Room,
  User,
  FriendRelationship,
  UserBlock,
  MetricEvent,
  SocialNotification,
} = require('../models');

const apply = process.argv.includes('--apply');

const countDocuments = async (model) => model.countDocuments();

const copy = async (label, model, writer, transform = (value) => value, sourceQuery = model.find()) => {
  const count = await countDocuments(model);
  process.stdout.write(`${label}: ${count} source records${apply ? '' : ' (dry run)'}\n`);
  if (!apply) return count;

  const cursor = sourceQuery.cursor();
  let copied = 0;
  for await (const value of cursor) {
    await writer(transform(value));
    copied += 1;
  }
  process.stdout.write(`${label}: copied ${copied}\n`);
  return copied;
};

const copyRelationships = async () => {
  const count = await countDocuments(FriendRelationship);
  process.stdout.write(`friend relationships: ${count} source records${apply ? '' : ' (dry run)'}\n`);
  if (!apply) return count;
  const cursor = FriendRelationship.find().cursor();
  for await (const relationship of cursor) {
    const users = await User.find({ id: { $in: [relationship.lowUserId, relationship.highUserId, relationship.requestedBy].filter(Boolean) } });
    await mirrorRelationship(relationship, users);
  }
  return count;
};

const copyBlocks = async () => {
  const count = await countDocuments(UserBlock);
  process.stdout.write(`user blocks: ${count} source records${apply ? '' : ' (dry run)'}\n`);
  if (!apply) return count;
  const cursor = UserBlock.find().cursor();
  for await (const block of cursor) {
    const [blocker, blocked] = await Promise.all([
      User.findOne({ id: block.blockerId }),
      User.findOne({ id: block.blockedId }),
    ]);
    await mirrorBlock(block, blocker, blocked);
  }
  return count;
};

const copyMetrics = async () => copy(
  'metrics',
  MetricEvent,
  mirrorMetricEvent,
  (event) => ({
    ...event.toObject(),
    event: event.event,
  }),
);

const copyNotifications = async () => copy(
  'notifications',
  SocialNotification,
  mirrorNotification,
  (notification) => notification.toObject(),
);

const run = async () => {
  if (!(await initializePostgres())) throw new Error('PostgreSQL is unavailable');
  await database.connect();

  try {
    const summary = {
      users: await copy('users', User, mirrorUser),
      rooms: await copy(
        'rooms',
        Room,
        mirrorRoom,
        (room) => room,
        Room.find().populate('users').populate('admin').populate('owner'),
      ),
      relationships: await copyRelationships(),
      blocks: await copyBlocks(),
      notifications: await copyNotifications(),
      metrics: await copyMetrics(),
    };
    process.stdout.write(`MongoDB session records are intentionally not copied; all sessions must re-authenticate after cutover.\n`);
    return summary;
  } finally {
    await mongoose.disconnect();
    await pool.end();
  }
};

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { run };
