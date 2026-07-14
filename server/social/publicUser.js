const publicUserProjection = (user) => {
  if (!user) {
    return null;
  }

  const profileKey = user.usernameNormalized || (user.showWCAID ? user.wcaId : null);
  const projection = {
    id: user.id,
    username: user.username || null,
    displayName: user.preferRealName ? user.name : (user.username || null),
  };

  if (profileKey) {
    projection.profileKey = profileKey;
  }

  if (user.showWCAID) {
    projection.wcaId = user.wcaId || null;
    projection.avatar = user.avatar || {};
  }

  return projection;
};

module.exports = publicUserProjection;
