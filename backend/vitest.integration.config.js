// Integration test configuration for backend
// Uses actual database connections instead of mocks
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.integration.js'],
    include: ['tests/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // Longer timeout for database operations
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    threads: false, // Run sequentially to avoid database conflicts
  },
});
