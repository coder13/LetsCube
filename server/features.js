const FEATURES = Object.freeze({
  friends: process.env.NODE_ENV !== 'production',
  solveHistory: ['development', 'dev'].includes(process.env.NODE_ENV),
});

const isFeatureEnabled = (feature) => FEATURES[feature] === true;

module.exports = {
  FEATURES,
  isFeatureEnabled,
};
