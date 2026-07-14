/* eslint-env jest */

const originalNodeEnv = process.env.NODE_ENV;

const loadFeatures = (nodeEnv) => {
  jest.resetModules();
  process.env.NODE_ENV = nodeEnv;
  // eslint-disable-next-line global-require
  return require('./features');
};

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('feature flags', () => {
  it('keeps friends out of production', () => {
    expect(loadFeatures('production').isFeatureEnabled('friends')).toBe(false);
  });

  it('keeps friends available to local development', () => {
    expect(loadFeatures('development').isFeatureEnabled('friends')).toBe(true);
  });

  it('keeps solve history development-only', () => {
    expect(loadFeatures('development').isFeatureEnabled('solveHistory')).toBe(true);
    expect(loadFeatures('dev').isFeatureEnabled('solveHistory')).toBe(true);
    expect(loadFeatures('production').isFeatureEnabled('solveHistory')).toBe(false);
    expect(loadFeatures('prod').isFeatureEnabled('solveHistory')).toBe(false);
  });
});
