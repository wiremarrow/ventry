module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.integration.spec.ts',
    '!**/*.interface.ts',
    '!**/main.ts',
  ],
  coverageDirectory: '../coverage-integration',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test-setup-integration.ts'],
  testTimeout: 30000,
};