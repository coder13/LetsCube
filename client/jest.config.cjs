module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/custom-service-worker.js'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(mp3|ogg)$': '<rootDir>/test/fileMock.js',
  },
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
};
