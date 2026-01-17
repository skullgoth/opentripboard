/**
 * Test setup file - runs before all tests
 * Configures the test environment
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Global test setup
beforeAll(async () => {
  // Setup runs once before all tests
});

// Global test teardown
afterAll(async () => {
  // Cleanup runs once after all tests
});

// Per-test setup
beforeEach(async () => {
  // Runs before each test
});

// Per-test teardown
afterEach(async () => {
  // Runs after each test
});
