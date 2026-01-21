/**
 * Integration test setup file
 * Uses actual database connection for integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Set test environment variables - use actual database
process.env.NODE_ENV = 'test';
// Use the same database as development for integration tests
// Integration tests will clean up their own test data
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/opentripboard';
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
