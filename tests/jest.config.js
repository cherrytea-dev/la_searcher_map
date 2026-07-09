module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: {},
  clearMocks: true,
};
