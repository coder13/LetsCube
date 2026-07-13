const { normalizeUsername } = require('../username');

const upsertTestUser = (User, { code, userId }) => User.findOneAndUpdate({
  id: userId,
}, {
  id: userId,
  name: 'Cypress Test User',
  ...normalizeUsername('cypress'),
  wcaId: '2026TEST01',
  accessToken: `test-token-${code}`,
  avatar: {},
}, {
  upsert: true,
  useFindAndModify: false,
  new: true,
});

module.exports = { upsertTestUser };
