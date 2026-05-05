export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
  maxWorkers: '50%',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Coverage is opt-in: pass --coverage to enable. Always-on coverage adds
  // ~20-30% to local test runtime via ts-jest with no benefit when iterating.
  collectCoverage: false,
  coverageThreshold: {
    global: {
      statements: 55,
      branches: 45,
      functions: 45,
      lines: 55,
    },
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
