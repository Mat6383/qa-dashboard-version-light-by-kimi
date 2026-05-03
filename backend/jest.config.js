/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.(js|ts)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
        diagnostics: { ignoreCodes: [151001] },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'services/**/*.(js|ts)',
    'routes/**/*.(js|ts)',
    'validators/**/*.(js|ts)',
    'middleware/**/*.(js|ts)',
    'utils/**/*.(js|ts)',
    'bootstrap/**/*.(js|ts)',
    '!services/logger.service.(js|ts)',
    '!services/testmo.service.(js|ts)',
    '!services/gitlab.service.(js|ts)',
    '!services/sync.service.(js|ts)',
    '!services/status-sync.service.(js|ts)',
    '!services/auto-sync-config.service.(js|ts)',
    '!services/report/**/*.(js|ts)',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 45,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
