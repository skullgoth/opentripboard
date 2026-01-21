// Integration test configuration for backend
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/integration-setup.js'],
    include: ['tests/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    threads: false, // Run integration tests sequentially to avoid database conflicts
    maxThreads: 1,
    minThreads: 1,
  },
});
