/**
 * Unit tests for Crypto Utility
 * Tests password hashing, verification, and validation
 */

import { describe, it, expect, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../../../src/utils/crypto.js';

// Mock console.error to keep test output clean
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Crypto Utility', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'SecurePass123';

      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePass123';

      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt makes each hash unique
    });

    it('should generate bcrypt format hash', async () => {
      const password = 'SecurePass123';

      const hash = await hashPassword(password);

      // bcrypt hashes start with $2a$ or $2b$ followed by cost factor
      expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
    });

    it('should throw error for null password', async () => {
      await expect(hashPassword(null)).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for undefined password', async () => {
      await expect(hashPassword(undefined)).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for empty string', async () => {
      await expect(hashPassword('')).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for non-string password', async () => {
      await expect(hashPassword(12345)).rejects.toThrow(
        'Password must be a non-empty string'
      );
    });

    it('should throw error for password shorter than 8 characters', async () => {
      await expect(hashPassword('Short1')).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should accept password exactly 8 characters', async () => {
      const password = '12345678';

      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
    });

    it('should handle very long passwords', async () => {
      const password = 'A'.repeat(100) + '1a';

      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
    });

    it('should handle passwords with special characters', async () => {
      const password = 'P@$$w0rd!#$%^&*()';

      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
    });

    it('should handle unicode passwords', async () => {
      const password = 'Пароль123!';

      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);

      const result = await verifyPassword('WrongPassword123', hash);

      expect(result).toBe(false);
    });

    it('should return false for similar but different password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);

      const result = await verifyPassword('SecurePass124', hash);

      expect(result).toBe(false);
    });

    it('should be case sensitive', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);

      const result = await verifyPassword('securepass123', hash);

      expect(result).toBe(false);
    });

    it('should return false for null password', async () => {
      const hash = await hashPassword('SecurePass123');

      const result = await verifyPassword(null, hash);

      expect(result).toBe(false);
    });

    it('should return false for undefined password', async () => {
      const hash = await hashPassword('SecurePass123');

      const result = await verifyPassword(undefined, hash);

      expect(result).toBe(false);
    });

    it('should return false for empty string password', async () => {
      const hash = await hashPassword('SecurePass123');

      const result = await verifyPassword('', hash);

      expect(result).toBe(false);
    });

    it('should return false for non-string password', async () => {
      const hash = await hashPassword('SecurePass123');

      const result = await verifyPassword(12345, hash);

      expect(result).toBe(false);
    });

    it('should return false for null hash', async () => {
      const result = await verifyPassword('SecurePass123', null);

      expect(result).toBe(false);
    });

    it('should return false for undefined hash', async () => {
      const result = await verifyPassword('SecurePass123', undefined);

      expect(result).toBe(false);
    });

    it('should return false for empty string hash', async () => {
      const result = await verifyPassword('SecurePass123', '');

      expect(result).toBe(false);
    });

    it('should return false for non-string hash', async () => {
      const result = await verifyPassword('SecurePass123', 12345);

      expect(result).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const result = await verifyPassword('SecurePass123', 'not-a-valid-hash');

      expect(result).toBe(false);
    });

    it('should handle special characters in password', async () => {
      const password = 'P@$$w0rd!#$%^&*()';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('should handle unicode passwords', async () => {
      const password = 'Пароль123!';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('SecurePass123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require minimum 8 characters', () => {
      const result = validatePasswordStrength('Short1A');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
    });

    it('should accept exactly 8 characters if other requirements met', () => {
      const result = validatePasswordStrength('Secure1a');

      expect(result.isValid).toBe(true);
    });

    it('should require maximum 128 characters', () => {
      const longPassword = 'A'.repeat(129) + 'a1';

      const result = validatePasswordStrength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be less than 128 characters'
      );
    });

    it('should accept exactly 128 characters', () => {
      const password = 'A'.repeat(125) + 'a1B';

      const result = validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
    });

    it('should require at least one lowercase letter', () => {
      const result = validatePasswordStrength('UPPERCASE123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should require at least one uppercase letter', () => {
      const result = validatePasswordStrength('lowercase123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should require at least one number', () => {
      const result = validatePasswordStrength('NoNumbersHere');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should return multiple errors for multiple violations', () => {
      const result = validatePasswordStrength('short');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      );
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should return error for null password', () => {
      const result = validatePasswordStrength(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should return error for undefined password', () => {
      const result = validatePasswordStrength(undefined);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should return error for empty string', () => {
      const result = validatePasswordStrength('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should return error for non-string password', () => {
      const result = validatePasswordStrength(12345);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should accept special characters without requiring them', () => {
      const result = validatePasswordStrength('Secure1a');

      expect(result.isValid).toBe(true);
    });

    it('should accept password with special characters', () => {
      const result = validatePasswordStrength('P@$$w0rd!');

      expect(result.isValid).toBe(true);
    });

    it('should accept password with spaces', () => {
      const result = validatePasswordStrength('Secure Pass 1');

      expect(result.isValid).toBe(true);
    });

    it('should handle unicode lowercase letters', () => {
      // Unicode lowercase is not matched by /[a-z]/
      const result = validatePasswordStrength('UPPERCASE123é');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should handle unicode uppercase letters', () => {
      // Unicode uppercase is not matched by /[A-Z]/
      const result = validatePasswordStrength('lowercase123É');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });
  });
});
