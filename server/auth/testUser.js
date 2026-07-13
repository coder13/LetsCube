const { normalizeUsername } = require('../username');

const upsertTestUser = (User, { code, userId }) => User.findOneAndUpdate({
  id: userId,
}, {
  id: userId,
  name: `Cypress Test User ${userId}`,
  ...normalizeUsername(`cypress-${userId}`),
  wcaId: `2026TEST${userId}`,
  accessToken: `test-token-${code}`,
  avatar: {},
}, {
  upsert: true,
  useFindAndModify: false,
  new: true,
});

module.exports = { upsertTestUser };
