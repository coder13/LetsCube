/* eslint-env jest */

const originalNodeEnv = process.env.NODE_ENV;
const originalSolveHistoryUserIds = process.env.FEATURE_SOLVE_HISTORY_USER_IDS;
const originalFriendsUserIds = process.env.FEATURE_FRIENDS_USER_IDS;

const loadFeatures = ({ nodeEnv, solveHistoryUserIds, friendsUserIds }) => {
  jest.resetModules();
  process.env.NODE_ENV = nodeEnv;
  if (solveHistoryUserIds === undefined) {
    delete process.env.FEATURE_SOLVE_HISTORY_USER_IDS;
  } else {
    process.env.FEATURE_SOLVE_HISTORY_USER_IDS = solveHistoryUserIds;
  }
  if (friendsUserIds === undefined) {
    delete process.env.FEATURE_FRIENDS_USER_IDS;
  } else {
    process.env.FEATURE_FRIENDS_USER_IDS = friendsUserIds;
  }
  // eslint-disable-next-line global-require
  return require('./features');
};

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalSolveHistoryUserIds === undefined) {
    delete process.env.FEATURE_SOLVE_HISTORY_USER_IDS;
  } else {
    process.env.FEATURE_SOLVE_HISTORY_USER_IDS = originalSolveHistoryUserIds;
  }
  if (originalFriendsUserIds === undefined) {
    delete process.env.FEATURE_FRIENDS_USER_IDS;
  } else {
    process.env.FEATURE_FRIENDS_USER_IDS = originalFriendsUserIds;
  }
});

describe('feature flags', () => {
  it('keeps friends out of production', () => {
    expect(loadFeatures({ nodeEnv: 'production' }).isFeatureEnabled('friends')).toBe(false);
  });

  it('keeps friends available to local development', () => {
    expect(loadFeatures({ nodeEnv: 'development' }).isFeatureEnabled('friends')).toBe(true);
  });

  it('keeps solve history development-only', () => {
    expect(loadFeatures({ nodeEnv: 'development' }).isFeatureEnabled('solveHistory')).toBe(true);
    expect(loadFeatures({ nodeEnv: 'dev' }).isFeatureEnabled('solveHistory')).toBe(true);
    expect(loadFeatures({ nodeEnv: 'production' }).isFeatureEnabled('solveHistory')).toBe(false);
    expect(loadFeatures({ nodeEnv: 'prod' }).isFeatureEnabled('solveHistory')).toBe(false);
  });

  it('can enable a disabled feature for selected WCA users', () => {
    const features = loadFeatures({
      nodeEnv: 'prod',
      solveHistoryUserIds: '8184, 42, invalid, 0',
      friendsUserIds: '8184',
    });

    expect(features.isFeatureEnabled('solveHistory')).toBe(false);
    expect(features.isFeatureEnabledForUser('solveHistory', 8184)).toBe(true);
    expect(features.isFeatureEnabledForUser('solveHistory', '42')).toBe(true);
    expect(features.isFeatureEnabledForUser('solveHistory', 8185)).toBe(false);
    expect(features.isFeatureEnabledForUser('friends', 8184)).toBe(true);
    expect(features.isFeatureEnabledForUser('unknown', 8184)).toBe(false);
  });
});
