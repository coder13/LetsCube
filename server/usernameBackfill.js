const { canonicalizeUsername, normalizeUsername } = require('./username');

const identifier = (user) => (user.id === undefined ? user._id.toString() : user.id);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const containsEmailMarker = (value) => (
  typeof value === 'string' && canonicalizeUsername(value).includes('@')
);

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
  const postgresUsers = [];
  const invalid = [];
  let empty = 0;
  let privacyRemoved = 0;
  let valid = 0;

  analyzed.forEach((entry) => {
    const { user } = entry;
    let targetUsername;
    let targetUsernameNormalized;

    if (entry.error) {
      invalid.push({ id: identifier(user), code: entry.error.code });
      const removePrivateValue = containsEmailMarker(user.username);
      if (removePrivateValue) {
        privacyRemoved += 1;
      } else {
        targetUsername = user.username;
      }
    } else if (!entry.usernameNormalized) {
      empty += 1;
    } else if (collisionKeys.has(entry.usernameNormalized)) {
      targetUsername = entry.username;
    } else {
      valid += 1;
      targetUsername = entry.username;
      targetUsernameNormalized = entry.usernameNormalized;
    }

    const operation = changedOperation(
      user,
      {
        ...(targetUsername === undefined ? {} : { username: targetUsername }),
        ...(targetUsernameNormalized === undefined
          ? {} : { usernameNormalized: targetUsernameNormalized }),
      },
      {
        ...(targetUsername === undefined ? { username: '' } : {}),
        ...(targetUsernameNormalized === undefined ? { usernameNormalized: '' } : {}),
      },
    );

    if (operation) {
      operations.push(operation);
    }

    postgresUsers.push({
      wcaUserId: user.id,
      username: targetUsername,
      usernameNormalized: targetUsernameNormalized,
    });
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
      privacyRemoved,
      pendingChanges: operations.length,
    },
    postgresUsers,
  };
};

const assertUsernameRolloutReady = (report) => {
  if (report.pendingChanges) {
    throw new Error('Username backfill verification still has pending changes');
  }
  if (report.collisions.length) {
    throw new Error(
      `Cannot create username index: ${report.collisions.length} collision group(s) require resolution`,
    );
  }
};

module.exports = {
  assertUsernameRolloutReady,
  planUsernameBackfill,
};
