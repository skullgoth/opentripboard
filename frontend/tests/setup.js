/**
 * Vitest setup file for frontend unit tests
 * Runs before each test file to ensure clean state
 */

import { beforeEach, vi } from 'vitest';

// Clear all mocks between tests for isolation
beforeEach(() => {
  vi.clearAllMocks();
});
