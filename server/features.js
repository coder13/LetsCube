const FEATURES = Object.freeze({
  friends: process.env.NODE_ENV !== 'production',
  solveHistory: ['development', 'dev'].includes(process.env.NODE_ENV),
});

const isFeatureEnabled = (feature) => FEATURES[feature] === true;

const userFeatureEnvironmentKey = (feature) => `FEATURE_${feature
  .replace(/([a-z])([A-Z])/g, '$1_$2')
  .toUpperCase()}_USER_IDS`;

const parseUserIds = (value) => new Set((value || '')
  .split(',')
  .map((userId) => userId.trim())
  .filter((userId) => /^[1-9]\d*$/.test(userId)));

const USER_FEATURES = Object.freeze(Object.fromEntries(
  Object.keys(FEATURES).map((feature) => [
    feature,
    parseUserIds(process.env[userFeatureEnvironmentKey(feature)]),
  ]),
));

const isFeatureEnabledForUser = (feature, userId) => (
  isFeatureEnabled(feature)
  || (typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0
    ? USER_FEATURES[feature]?.has(String(userId)) === true
    : typeof userId === 'string' && /^[1-9]\d*$/.test(userId)
      ? USER_FEATURES[feature]?.has(userId) === true
      : false)
);

module.exports = {
  FEATURES,
  isFeatureEnabled,
  isFeatureEnabledForUser,
};
