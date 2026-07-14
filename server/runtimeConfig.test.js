/* eslint-env jest */

// eslint-disable-next-line global-require
const loadRuntimeConfig = () => require('./runtimeConfig');

describe('Grand Prix runtime configuration', () => {
  const originalValue = process.env.GRAND_PRIX_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.GRAND_PRIX_ENABLED;
    } else {
      process.env.GRAND_PRIX_ENABLED = originalValue;
    }
    jest.resetModules();
  });

  it('is disabled by default', () => {
    delete process.env.GRAND_PRIX_ENABLED;

    expect(loadRuntimeConfig().grandPrix.enabled).toBe(false);
  });

  it('is enabled only by the explicit lowercase true value', () => {
    process.env.GRAND_PRIX_ENABLED = 'true';
    expect(loadRuntimeConfig().grandPrix.enabled).toBe(true);

    jest.resetModules();
    process.env.GRAND_PRIX_ENABLED = 'TRUE';
    expect(loadRuntimeConfig().grandPrix.enabled).toBe(false);
  });
});

describe('social feature runtime configuration', () => {
  const originalValue = process.env.SOCIAL_FEATURES_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.SOCIAL_FEATURES_ENABLED;
    } else {
      process.env.SOCIAL_FEATURES_ENABLED = originalValue;
    }
    jest.resetModules();
  });

  it('is disabled by default', () => {
    delete process.env.SOCIAL_FEATURES_ENABLED;

    expect(loadRuntimeConfig().socialFeatures.enabled).toBe(false);
  });

  it('is enabled only by the explicit lowercase true value', () => {
    process.env.SOCIAL_FEATURES_ENABLED = 'true';
    expect(loadRuntimeConfig().socialFeatures.enabled).toBe(true);

    jest.resetModules();
    process.env.SOCIAL_FEATURES_ENABLED = 'TRUE';
    expect(loadRuntimeConfig().socialFeatures.enabled).toBe(false);
  });
});
