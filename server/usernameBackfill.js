const { normalizeUsername } = require('./username');

const identifier = (user) => (user.id === undefined ? user._id.toString() : user.id);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const containsEmailMarker = (value) => typeof value === 'string' && value.includes('@');

const changedOperation = (user, set, unset) => {
  const changedSet = Object.entries(set).some(([key, value]) => user[key] !== value);
  const changedUnset = Object.keys(unset).some((key) => hasOwn(user, key));
  if (!changedSet && !changedUnset) {
    return null;
  }

  const update = {};
  if (Object.keys(set).length) {
    update.$set = set;
  }
  if (Object.keys(unset).length) {
    update.$unset = unset;
  }

  return {
    updateOne: {
      filter: { _id: user._id },
      update,
    },
  };
};

const planUsernameBackfill = (users) => {
  const analyzed = users.map((user) => {
    try {
      return { user, ...normalizeUsername(user.username) };
    } catch (err) {
      return { user, error: err };
    }
  });
  const grouped = new Map();

  analyzed.forEach((entry) => {
    if (!entry.usernameNormalized) {
      return;
    }
    const matches = grouped.get(entry.usernameNormalized) || [];
    matches.push(entry);
    grouped.set(entry.usernameNormalized, matches);
  });

  const collisionKeys = new Set(
    [...grouped.entries()].filter(([, entries]) => entries.length > 1).map(([key]) => key),
  );
  const operations = [];
  const invalid = [];
  let empty = 0;
  let valid = 0;

  analyzed.forEach((entry) => {
    const { user } = entry;
    let operation;

    if (entry.error) {
      invalid.push({ id: identifier(user), code: entry.error.code });
      operation = changedOperation(user, {}, {
        ...(containsEmailMarker(user.username) ? { username: '' } : {}),
        usernameNormalized: '',
      });
    } else if (!entry.usernameNormalized) {
      empty += 1;
      operation = changedOperation(user, {}, { username: '', usernameNormalized: '' });
    } else if (collisionKeys.has(entry.usernameNormalized)) {
      operation = changedOperation(user, { username: entry.username }, { usernameNormalized: '' });
    } else {
      valid += 1;
      operation = changedOperation(user, {
        username: entry.username,
        usernameNormalized: entry.usernameNormalized,
      }, {});
    }

    if (operation) {
      operations.push(operation);
    }
  });

  const collisions = [...collisionKeys].sort().map((usernameNormalized) => ({
    usernameNormalized,
    users: grouped.get(usernameNormalized).map(({ user, username }) => ({
      id: identifier(user),
      username,
    })),
  }));

  return {
    operations,
    report: {
      scanned: users.length,
      valid,
      empty,
      invalid,
      collisions,
      pendingChanges: operations.length,
    },
  };
};

module.exports = { planUsernameBackfill };
