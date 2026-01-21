/**
 * Integration test for account lockout mechanism
 * Tests the complete lockout flow end-to-end with actual database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, closePool } from '../../src/db/connection.js';
import * as userService from '../../src/services/user-service.js';
import { hashPassword } from '../../src/utils/crypto.js';

describe('Account Lockout Integration Tests', () => {
  let testUser;
  const TEST_EMAIL = 'lockout-test@example.com';
  const CORRECT_PASSWORD = 'CorrectPassword123';
  const WRONG_PASSWORD = 'WrongPassword456';

  beforeAll(async () => {
    // Ensure test database is ready
    await query('SELECT 1');
  });

  afterAll(async () => {
    // Cleanup: Remove test user
    try {
      await query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    } catch (error) {
      // Ignore cleanup errors
    }
    await closePool();
  });

  beforeEach(async () => {
    // Clean up any existing test user
    await query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);

    // Create a fresh test user directly in the database
    const passwordHash = await hashPassword(CORRECT_PASSWORD);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, failed_login_attempts, locked_until)
       VALUES ($1, $2, $3, $4, 0, NULL)
       RETURNING id, email, full_name, role, created_at, updated_at`,
      [TEST_EMAIL, passwordHash, 'Lockout Test User', 'user']
    );
    testUser = result.rows[0];
  });

  describe('Account Lockout Flow', () => {
    it('should lock account after 5 failed login attempts', async () => {
      // Attempt 1-4: Should increment failed_login_attempts but not lock
      for (let i = 1; i <= 4; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
          expect.fail('Should have thrown AuthenticationError');
        } catch (error) {
          expect(error.message).toBe('Invalid email or password');
        }

        // Verify failed attempts are being tracked
        const userCheck = await query(
          'SELECT failed_login_attempts FROM users WHERE id = $1',
          [testUser.id]
        );
        expect(userCheck.rows[0].failed_login_attempts).toBe(i);
      }

      // Attempt 5: Should lock the account
      try {
        await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        expect.fail('Should have thrown AuthenticationError');
      } catch (error) {
        expect(error.message).toContain('Account locked due to 5 failed login attempts');
        expect(error.message).toContain('15 minutes');
      }

      // Verify account is locked in database
      const lockedUser = await query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [testUser.id]
      );
      expect(lockedUser.rows[0].failed_login_attempts).toBe(5);
      expect(lockedUser.rows[0].locked_until).not.toBeNull();
    });

    it('should reject login attempts while account is locked', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        } catch (error) {
          // Expected
        }
      }

      // Attempt 6: Should be rejected with "Account is locked" message
      try {
        await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        expect.fail('Should have thrown AuthenticationError');
      } catch (error) {
        expect(error.message).toContain('Account is locked due to multiple failed login attempts');
        expect(error.message).toMatch(/try again in \d+ minute/);
      }

      // Even with correct password, should still be locked
      try {
        await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
        expect.fail('Should have thrown AuthenticationError');
      } catch (error) {
        expect(error.message).toContain('Account is locked due to multiple failed login attempts');
      }
    });

    it('should allow login after lockout expires', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        } catch (error) {
          // Expected
        }
      }

      // Verify account is locked
      try {
        await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
        expect.fail('Should be locked');
      } catch (error) {
        expect(error.message).toContain('Account is locked');
      }

      // Simulate time passing by manually expiring the lockout
      // Set locked_until to 1 second ago
      await query(
        `UPDATE users
         SET locked_until = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [testUser.id]
      );

      // Now login should succeed
      const result = await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(TEST_EMAIL);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reset failed attempts counter on successful login', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        } catch (error) {
          // Expected
        }
      }

      // Verify failed attempts counter
      let userCheck = await query(
        'SELECT failed_login_attempts FROM users WHERE id = $1',
        [testUser.id]
      );
      expect(userCheck.rows[0].failed_login_attempts).toBe(3);

      // Successful login should reset counter
      await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);

      // Verify counter is reset to 0
      userCheck = await query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [testUser.id]
      );
      expect(userCheck.rows[0].failed_login_attempts).toBe(0);
      expect(userCheck.rows[0].locked_until).toBeNull();
    });

    it('should track failed attempts per account, not globally', async () => {
      // Create a second test user
      const SECOND_EMAIL = 'lockout-test-2@example.com';
      const passwordHash = await hashPassword(CORRECT_PASSWORD);
      const secondUser = await query(
        `INSERT INTO users (email, password_hash, full_name, role, failed_login_attempts, locked_until)
         VALUES ($1, $2, $3, $4, 0, NULL)
         RETURNING id, email`,
        [SECOND_EMAIL, passwordHash, 'Second Test User', 'user']
      );

      try {
        // Make 3 failed attempts on first user
        for (let i = 0; i < 3; i++) {
          try {
            await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
          } catch (error) {
            // Expected
          }
        }

        // Make 2 failed attempts on second user
        for (let i = 0; i < 2; i++) {
          try {
            await userService.authenticate(SECOND_EMAIL, WRONG_PASSWORD);
          } catch (error) {
            // Expected
          }
        }

        // Verify each account has its own counter
        const user1Check = await query(
          'SELECT failed_login_attempts FROM users WHERE id = $1',
          [testUser.id]
        );
        expect(user1Check.rows[0].failed_login_attempts).toBe(3);

        const user2Check = await query(
          'SELECT failed_login_attempts FROM users WHERE id = $1',
          [secondUser.rows[0].id]
        );
        expect(user2Check.rows[0].failed_login_attempts).toBe(2);

        // Both accounts should still be able to login with correct password
        // (neither has reached 5 failed attempts)
        const result1 = await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
        expect(result1).toBeDefined();

        const result2 = await userService.authenticate(SECOND_EMAIL, CORRECT_PASSWORD);
        expect(result2).toBeDefined();
      } finally {
        // Cleanup second user
        await query('DELETE FROM users WHERE email = $1', [SECOND_EMAIL]);
      }
    });

    it('should complete the full end-to-end lockout cycle', async () => {
      // Step 1: Attempt login 5 times with wrong password
      for (let i = 1; i <= 5; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
          expect.fail('Should have thrown AuthenticationError');
        } catch (error) {
          if (i < 5) {
            expect(error.message).toBe('Invalid email or password');
          } else {
            expect(error.message).toContain('Account locked due to 5 failed login attempts');
          }
        }
      }

      // Step 2: Verify 6th attempt returns 'Account locked' error
      try {
        await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
        expect.fail('Should be locked');
      } catch (error) {
        expect(error.message).toContain('Account is locked due to multiple failed login attempts');
      }

      // Step 3: Mock time passing - expire the lockout
      await query(
        `UPDATE users
         SET locked_until = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [testUser.id]
      );

      // Step 4: Verify login succeeds after lockout expires
      const loginResult = await userService.authenticate(TEST_EMAIL, CORRECT_PASSWORD);
      expect(loginResult).toBeDefined();
      expect(loginResult.user.email).toBe(TEST_EMAIL);
      expect(loginResult.accessToken).toBeDefined();

      // Step 5: Verify counter resets on successful login
      const finalCheck = await query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [testUser.id]
      );
      expect(finalCheck.rows[0].failed_login_attempts).toBe(0);
      expect(finalCheck.rows[0].locked_until).toBeNull();
    });
  });

  describe('Lockout Duration', () => {
    it('should lock account for 15 minutes', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        try {
          await userService.authenticate(TEST_EMAIL, WRONG_PASSWORD);
        } catch (error) {
          // Expected
        }
      }

      // Check locked_until timestamp
      const lockedUser = await query(
        `SELECT
           locked_until,
           EXTRACT(EPOCH FROM (locked_until - NOW())) / 60 as minutes_remaining
         FROM users
         WHERE id = $1`,
        [testUser.id]
      );

      const minutesRemaining = parseFloat(lockedUser.rows[0].minutes_remaining);
      // Should be approximately 15 minutes (allowing for some timing variance)
      expect(minutesRemaining).toBeGreaterThan(14.5);
      expect(minutesRemaining).toBeLessThan(15.5);
    });
  });
});
