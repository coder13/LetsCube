const config = require('../runtimeConfig');
const { mirrorUser } = require('../postgres/dualWrite');

const ANONYMOUS_NAME = 'Anonymous User';

const publicAdminUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  wcaId: user.wcaId,
  anonymizedAt: user.anonymizedAt,
});

const anonymizeUser = async (user, administratorId, now = new Date()) => {
  if (user.anonymizedAt) {
    const postgresMirrorFailed = config.postgres.enabled && await mirrorUser(user) === null;
    return { alreadyAnonymized: true, postgresMirrorFailed, user };
  }

  user.name = ANONYMOUS_NAME;
  user.username = undefined;
  user.email = undefined;
  user.wcaId = undefined;
  user.accessToken = undefined;
  user.avatar = {};
  user.showWCAID = false;
  user.preferRealName = false;
  user.anonymizedAt = now;
  user.anonymizedBy = administratorId;

  const savedUser = await user.save();
  const postgresMirrorFailed = config.postgres.enabled && await mirrorUser(savedUser) === null;
  return { alreadyAnonymized: false, postgresMirrorFailed, user: savedUser };
};

module.exports = {
  ANONYMOUS_NAME,
  anonymizeUser,
  publicAdminUser,
};
