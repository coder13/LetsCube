const FEATURES = Object.freeze({
  friends: process.env.NODE_ENV !== 'production',
});

export const isFeatureEnabled = (feature) => FEATURES[feature] === true;

export default FEATURES;
