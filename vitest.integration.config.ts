import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test-integration/**/*.test.ts'],
    setupFiles: ['./test-integration/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // Integration tests share a single MongoDB container and the same
    // MongoDBClient singleton; running them in parallel risks db/collection
    // collisions and singleton state stomping. Force serial execution.
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      // Keep integration coverage in its own directory so the unit suite's
      // coverage report doesn't get clobbered when both are collected on CI.
      reportsDirectory: 'coverage-integration',
    },
  },
});
