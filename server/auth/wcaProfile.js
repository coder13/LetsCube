const buildWcaUserUpdate = (profile) => ({
  id: Number(profile.id),
  name: profile.name,
  wcaId: profile.wca_id,
  avatar: profile.avatar,
});

module.exports = {
  buildWcaUserUpdate,
};
