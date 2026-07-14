const buildWcaUserUpdate = (profile, accessToken) => ({
  id: Number(profile.id),
  name: profile.name,
  wcaId: profile.wca_id,
  accessToken,
  avatar: profile.avatar,
});

module.exports = {
  buildWcaUserUpdate,
};
