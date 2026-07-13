const { User } = require('../models');

const persistWcaProfile = async ({ profile, accessToken }) => {
  const id = +profile.id;
  const existingUser = await User.findOne({ id });
  if (existingUser && existingUser.anonymizedAt) {
    return existingUser;
  }

  const filter = existingUser
    ? { id, anonymizedAt: { $exists: false } }
    : { id };
  const user = await User.findOneAndUpdate(filter, {
    id,
    name: profile.name,
    email: profile.email,
    wcaId: profile.wca_id,
    accessToken,
    avatar: profile.avatar,
  }, {
    upsert: !existingUser,
    useFindAndModify: false,
    new: true,
  });
  return user || User.findOne({ id });
};

module.exports = { persistWcaProfile };
