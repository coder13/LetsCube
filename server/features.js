const FEATURES = Object.freeze({
  friends: process.env.NODE_ENV !== 'production',
});

const isFeatureEnabled = (feature) => FEATURES[feature] === true;

module.exports = {
  FEATURES,
  isFeatureEnabled,
};
