/**
 * Integration test setup file - runs before all integration tests
 * Sets up database connections and test environment
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';

let pool;

// Global test setup
beforeAll(async () => {
  // Create a connection pool for integration tests
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Test database connection
  const client = await pool.connect();
  client.release();
});

// Global test teardown
afterAll(async () => {
  // Close database connections
  if (pool) {
    await pool.end();
  }
});

// Per-test setup
beforeEach(async () => {
  // Clean up test data before each test
  if (pool) {
    await pool.query('DELETE FROM refresh_tokens');
    await pool.query('DELETE FROM users WHERE email LIKE \'%@test-integration.example\'');
  }
});

// Per-test teardown
afterEach(async () => {
  // Additional cleanup after each test if needed
});

export { pool };
