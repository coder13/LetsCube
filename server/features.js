const FEATURES = Object.freeze({
  friends: true,
});

const isFeatureEnabled = (feature) => FEATURES[feature] === true;

module.exports = {
  FEATURES,
  isFeatureEnabled,
};
