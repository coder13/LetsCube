const USERNAME_MAX_LENGTH = 15;
const USERNAME_SEARCH_DEFAULT_LIMIT = 20;
const USERNAME_SEARCH_MAX_LIMIT = 50;
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

class UsernameError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'UsernameError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const invalidUsername = () => new UsernameError(
  'INVALID_USERNAME',
  'Username may only contain letters, numbers, underscores, and hyphens',
);

const canonicalizeUsername = (value) => (
  typeof value === 'string' ? value.normalize('NFKC').trim() : value
);

const normalizeUsername = (value, { allowEmpty = true } = {}) => {
  if (value === undefined || value === null) {
    if (allowEmpty) {
      return { username: undefined, usernameNormalized: undefined };
    }
    throw invalidUsername();
  }

  if (typeof value !== 'string') {
    throw invalidUsername();
  }

  const username = canonicalizeUsername(value);
  if (!username) {
    if (allowEmpty) {
      return { username: undefined, usernameNormalized: undefined };
    }
    throw invalidUsername();
  }

  if (username.length > USERNAME_MAX_LENGTH || !USERNAME_PATTERN.test(username)) {
    throw invalidUsername();
  }

  return {
    username,
    usernameNormalized: username.toLowerCase(),
  };
};

const usernameConflict = () => new UsernameError(
  'USERNAME_TAKEN',
  'Username is already in use',
  409,
);

const isUsernameDuplicateKeyError = (err) => err && err.code === 11000 && (
  (err.keyPattern && err.keyPattern.usernameNormalized)
  || (err.message && err.message.includes('users_username_normalized_unique'))
);

const findUserByUsername = (User, value) => {
  const { usernameNormalized } = normalizeUsername(value, { allowEmpty: false });
  return User.findOne({ usernameNormalized });
};

const searchUsersByUsernamePrefix = (User, value, requestedLimit) => {
  const { usernameNormalized } = normalizeUsername(value, { allowEmpty: false });
  const parsedLimit = Number(requestedLimit);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, USERNAME_SEARCH_MAX_LIMIT)
    : USERNAME_SEARCH_DEFAULT_LIMIT;

  return User.find({
    usernameNormalized: {
      $gte: usernameNormalized,
      $lt: `${usernameNormalized}\uffff`,
    },
  }).sort({ usernameNormalized: 1 }).limit(limit);
};

const updateUsername = async (User, user, value) => {
  if (value === undefined) {
    throw new UsernameError('MISSING_USERNAME', 'Missing username from request');
  }

  const normalized = normalizeUsername(value);
  if (normalized.usernameNormalized) {
    const existingUser = await findUserByUsername(User, normalized.username);
    if (existingUser && existingUser.id.toString() !== user.id.toString()) {
      throw usernameConflict();
    }
  }

  user.username = normalized.username;
  user.usernameNormalized = normalized.usernameNormalized;

  try {
    return await user.save();
  } catch (err) {
    if (isUsernameDuplicateKeyError(err)) {
      throw usernameConflict();
    }
    throw err;
  }
};

module.exports = {
  USERNAME_MAX_LENGTH,
  USERNAME_SEARCH_DEFAULT_LIMIT,
  USERNAME_SEARCH_MAX_LIMIT,
  UsernameError,
  canonicalizeUsername,
  findUserByUsername,
  isUsernameDuplicateKeyError,
  normalizeUsername,
  searchUsersByUsernamePrefix,
  updateUsername,
};
