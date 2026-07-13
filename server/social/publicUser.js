const publicUserProjection = (user) => {
  if (!user) {
    return null;
  }

  const projection = {
    id: user.id,
    username: user.username || null,
    displayName: user.preferRealName ? user.name : (user.username || null),
  };

  if (user.showWCAID) {
    projection.wcaId = user.wcaId || null;
    projection.avatar = user.avatar || {};
  }

  return projection;
};

module.exports = publicUserProjection;
