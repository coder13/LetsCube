const FEATURES = Object.freeze({
  friends: true,
});

export const isFeatureEnabled = (feature) => FEATURES[feature] === true;

export default FEATURES;
