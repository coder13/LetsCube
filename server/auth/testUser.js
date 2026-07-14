const { normalizeUsername } = require('../username');

const upsertTestUser = (User, { code, userId }) => {
  const isDefaultUser = userId === 990001;
  const username = isDefaultUser ? 'cypress' : `cypress-${userId}`;

  return User.findOneAndUpdate({
    id: userId,
  }, {
    id: userId,
    name: isDefaultUser ? 'Cypress Test User' : `Cypress Test User ${userId}`,
    ...normalizeUsername(username),
    wcaId: isDefaultUser ? '2026TEST01' : `2026TEST${userId}`,
    accessToken: `test-token-${code}`,
    avatar: {},
  }, {
    upsert: true,
    useFindAndModify: false,
    new: true,
  });
};

module.exports = { upsertTestUser };
