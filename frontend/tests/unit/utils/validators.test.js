/**
 * Unit tests for Input Validation Utilities
 * Tests all 16 pure functions from src/utils/validators.js
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  validatePassword,
  generatePassword,
  isRequired,
  isValidLength,
  isValidDate,
  isValidDateRange,
  isValidNumber,
  isValidCurrency,
  isValidUrl,
  isValidCoordinates,
  validateForm,
  validateCoverImage,
  validateImageDimensions,
  getFileExtension,
  formatFileSize,
} from '../../../src/utils/validators.js';
import { createMockFileWithSize, createMockImage } from '../../helpers.js';

describe('Validators', () => {
  // ─── isValidEmail ──────────────────────────────────────────
  describe('isValidEmail', () => {
    it('should accept a valid email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('should accept email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('should accept email with plus addressing', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should accept email with dots in local part', () => {
      expect(isValidEmail('first.last@example.com')).toBe(true);
    });

    it('should trim whitespace before validating', () => {
      expect(isValidEmail('  user@example.com  ')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should reject email without TLD', () => {
      expect(isValidEmail('user@example')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidEmail(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidEmail(undefined)).toBe(false);
    });

    it('should reject number', () => {
      expect(isValidEmail(12345)).toBe(false);
    });
  });

  // ─── validatePassword ──────────────────────────────────────
  describe('validatePassword', () => {
    it('should accept a valid password', () => {
      const result = validatePassword('SecurePass1');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require minimum 8 characters', () => {
      const result = validatePassword('Short1A');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should accept exactly 8 characters', () => {
      const result = validatePassword('Secure1a');
      expect(result.valid).toBe(true);
    });

    it('should require a lowercase letter', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require an uppercase letter', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require a number', () => {
      const result = validatePassword('NoNumbersHere');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for multiple violations', () => {
      const result = validatePassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject non-string input', () => {
      const result = validatePassword(12345);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
    });

    it('should reject null', () => {
      const result = validatePassword(null);
      expect(result.valid).toBe(false);
    });
  });

  // ─── generatePassword ──────────────────────────────────────
  describe('generatePassword', () => {
    it('should generate a password of default length 16', () => {
      const password = generatePassword();
      expect(password.length).toBe(16);
    });

    it('should generate a password of specified length', () => {
      const password = generatePassword(20);
      expect(password.length).toBe(20);
    });

    it('should enforce minimum length of 12', () => {
      const password = generatePassword(5);
      expect(password.length).toBe(12);
    });

    it('should generate a password that passes validatePassword', () => {
      const password = generatePassword();
      const result = validatePassword(password);
      expect(result.valid).toBe(true);
    });

    it('should generate different passwords on each call', () => {
      const passwords = new Set(Array.from({ length: 10 }, () => generatePassword()));
      expect(passwords.size).toBeGreaterThan(1);
    });
  });

  // ─── isRequired ────────────────────────────────────────────
  describe('isRequired', () => {
    it('should return true for non-empty string', () => {
      expect(isRequired('hello')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isRequired('')).toBe(false);
    });

    it('should return false for whitespace-only string', () => {
      expect(isRequired('   ')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isRequired(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRequired(undefined)).toBe(false);
    });

    it('should return true for non-empty array', () => {
      expect(isRequired([1, 2])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(isRequired([])).toBe(false);
    });

    it('should return true for number', () => {
      expect(isRequired(0)).toBe(true);
    });

    it('should return true for boolean', () => {
      expect(isRequired(false)).toBe(true);
    });
  });

  // ─── isValidLength ─────────────────────────────────────────
  describe('isValidLength', () => {
    it('should accept string within range', () => {
      expect(isValidLength('hello', 1, 10)).toBe(true);
    });

    it('should accept string at min boundary', () => {
      expect(isValidLength('ab', 2, 10)).toBe(true);
    });

    it('should accept string at max boundary', () => {
      expect(isValidLength('ab', 1, 2)).toBe(true);
    });

    it('should reject string below min', () => {
      expect(isValidLength('a', 5, 10)).toBe(false);
    });

    it('should reject string above max', () => {
      expect(isValidLength('hello world', 1, 5)).toBe(false);
    });

    it('should trim whitespace before checking', () => {
      expect(isValidLength('  hi  ', 1, 2)).toBe(true);
    });

    it('should reject non-string input', () => {
      expect(isValidLength(12345, 1, 10)).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidLength(null, 1, 10)).toBe(false);
    });

    it('should use default min 0 and max Infinity', () => {
      expect(isValidLength('')).toBe(true);
      expect(isValidLength('anything')).toBe(true);
    });
  });

  // ─── isValidDate ───────────────────────────────────────────
  describe('isValidDate', () => {
    it('should accept a valid date string', () => {
      expect(isValidDate('2025-06-01')).toBe(true);
    });

    it('should accept a Date object', () => {
      expect(isValidDate(new Date())).toBe(true);
    });

    it('should accept ISO date string', () => {
      expect(isValidDate('2025-06-01T12:00:00.000Z')).toBe(true);
    });

    it('should reject invalid date string', () => {
      expect(isValidDate('not-a-date')).toBe(false);
    });

    it('should reject invalid Date object', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });
  });

  // ─── isValidDateRange ──────────────────────────────────────
  describe('isValidDateRange', () => {
    it('should accept end date after start date', () => {
      expect(isValidDateRange('2025-06-01', '2025-06-07')).toBe(true);
    });

    it('should accept same start and end date', () => {
      expect(isValidDateRange('2025-06-01', '2025-06-01')).toBe(true);
    });

    it('should reject end date before start date', () => {
      expect(isValidDateRange('2025-06-07', '2025-06-01')).toBe(false);
    });

    it('should reject invalid start date', () => {
      expect(isValidDateRange('invalid', '2025-06-01')).toBe(false);
    });

    it('should reject invalid end date', () => {
      expect(isValidDateRange('2025-06-01', 'invalid')).toBe(false);
    });
  });

  // ─── isValidNumber ─────────────────────────────────────────
  describe('isValidNumber', () => {
    it('should accept a valid number', () => {
      expect(isValidNumber(42)).toBe(true);
    });

    it('should accept a numeric string', () => {
      expect(isValidNumber('42')).toBe(true);
    });

    it('should accept zero', () => {
      expect(isValidNumber(0)).toBe(true);
    });

    it('should accept negative numbers', () => {
      expect(isValidNumber(-5)).toBe(true);
    });

    it('should accept number at min boundary', () => {
      expect(isValidNumber(10, 10, 20)).toBe(true);
    });

    it('should accept number at max boundary', () => {
      expect(isValidNumber(20, 10, 20)).toBe(true);
    });

    it('should reject number below min', () => {
      expect(isValidNumber(5, 10, 20)).toBe(false);
    });

    it('should reject number above max', () => {
      expect(isValidNumber(25, 10, 20)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });

    it('should reject non-numeric string', () => {
      expect(isValidNumber('abc')).toBe(false);
    });
  });

  // ─── isValidCurrency ───────────────────────────────────────
  describe('isValidCurrency', () => {
    it('should accept a valid currency amount', () => {
      expect(isValidCurrency(19.99)).toBe(true);
    });

    it('should accept zero', () => {
      expect(isValidCurrency(0)).toBe(true);
    });

    it('should accept whole numbers', () => {
      expect(isValidCurrency(100)).toBe(true);
    });

    it('should accept one decimal place', () => {
      expect(isValidCurrency(9.5)).toBe(true);
    });

    it('should reject negative amounts', () => {
      expect(isValidCurrency(-5)).toBe(false);
    });

    it('should reject more than 2 decimal places', () => {
      expect(isValidCurrency('9.999')).toBe(false);
    });

    it('should accept exactly 2 decimal places', () => {
      expect(isValidCurrency('9.99')).toBe(true);
    });

    it('should reject NaN', () => {
      expect(isValidCurrency('abc')).toBe(false);
    });
  });

  // ─── isValidUrl ────────────────────────────────────────────
  describe('isValidUrl', () => {
    it('should accept a valid https URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should accept a valid http URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should accept URL with path', () => {
      expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
    });

    it('should reject invalid URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });

  // ─── isValidCoordinates ────────────────────────────────────
  describe('isValidCoordinates', () => {
    it('should accept valid coordinates', () => {
      expect(isValidCoordinates(48.8566, 2.3522)).toBe(true);
    });

    it('should accept boundary latitude values', () => {
      expect(isValidCoordinates(90, 0)).toBe(true);
      expect(isValidCoordinates(-90, 0)).toBe(true);
    });

    it('should accept boundary longitude values', () => {
      expect(isValidCoordinates(0, 180)).toBe(true);
      expect(isValidCoordinates(0, -180)).toBe(true);
    });

    it('should reject latitude out of range', () => {
      expect(isValidCoordinates(91, 0)).toBe(false);
      expect(isValidCoordinates(-91, 0)).toBe(false);
    });

    it('should reject longitude out of range', () => {
      expect(isValidCoordinates(0, 181)).toBe(false);
      expect(isValidCoordinates(0, -181)).toBe(false);
    });

    it('should reject NaN latitude', () => {
      expect(isValidCoordinates(NaN, 0)).toBe(false);
    });

    it('should reject NaN longitude', () => {
      expect(isValidCoordinates(0, NaN)).toBe(false);
    });
  });

  // ─── validateForm ──────────────────────────────────────────
  describe('validateForm', () => {
    it('should return valid for data passing all rules', () => {
      const data = { name: 'Trip', email: 'user@example.com' };
      const rules = {
        name: [{ fn: (v) => v && v.length > 0, message: 'Name is required' }],
        email: [{ fn: (v) => isValidEmail(v), message: 'Invalid email' }],
      };

      const result = validateForm(data, rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return errors for failing rules', () => {
      const data = { name: '', email: 'bad' };
      const rules = {
        name: [{ fn: (v) => v && v.length > 0, message: 'Name is required' }],
        email: [{ fn: (v) => isValidEmail(v), message: 'Invalid email' }],
      };

      const result = validateForm(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors.name).toContain('Name is required');
      expect(result.errors.email).toContain('Invalid email');
    });

    it('should handle multiple validators per field', () => {
      const data = { name: '' };
      const rules = {
        name: [
          { fn: (v) => v && v.length > 0, message: 'Name is required' },
          { fn: (v) => v && v.length >= 3, message: 'Name must be at least 3 characters' },
        ],
      };

      const result = validateForm(data, rules);

      expect(result.errors.name).toHaveLength(2);
    });

    it('should handle empty rules', () => {
      const result = validateForm({ name: 'Test' }, {});
      expect(result.valid).toBe(true);
    });
  });

  // ─── validateCoverImage ────────────────────────────────────
  describe('validateCoverImage', () => {
    it('should accept a valid JPEG file under 5MB', () => {
      const file = createMockFileWithSize('photo.jpg', 1024 * 1024, 'image/jpeg');
      const result = validateCoverImage(file);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept PNG files', () => {
      const file = createMockFileWithSize('photo.png', 1024, 'image/png');
      const result = validateCoverImage(file);
      expect(result.valid).toBe(true);
    });

    it('should accept WebP files', () => {
      const file = createMockFileWithSize('photo.webp', 1024, 'image/webp');
      const result = validateCoverImage(file);
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file type', () => {
      const file = createMockFileWithSize('photo.gif', 1024, 'image/gif');
      const result = validateCoverImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image must be JPEG, PNG, or WebP format');
    });

    it('should reject file over 5MB', () => {
      const file = createMockFileWithSize('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
      const result = validateCoverImage(file);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image size must be less than 5MB');
    });

    it('should reject null', () => {
      const result = validateCoverImage(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No file provided');
    });

    it('should reject undefined', () => {
      const result = validateCoverImage(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject non-File object', () => {
      const result = validateCoverImage({ name: 'fake.jpg' });
      expect(result.valid).toBe(false);
    });
  });

  // ─── validateImageDimensions ───────────────────────────────
  describe('validateImageDimensions', () => {
    it('should accept image meeting default minimums', () => {
      const img = createMockImage(1920, 1080);
      const result = validateImageDimensions(img);
      expect(result.valid).toBe(true);
    });

    it('should accept image at exact min dimensions', () => {
      const img = createMockImage(800, 400);
      const result = validateImageDimensions(img);
      expect(result.valid).toBe(true);
    });

    it('should reject image below min width', () => {
      const img = createMockImage(799, 400);
      const result = validateImageDimensions(img);
      expect(result.valid).toBe(false);
    });

    it('should reject image below min height', () => {
      const img = createMockImage(800, 399);
      const result = validateImageDimensions(img);
      expect(result.valid).toBe(false);
    });

    it('should reject image exceeding max dimensions', () => {
      const img = createMockImage(5001, 5001);
      const result = validateImageDimensions(img);
      expect(result.valid).toBe(false);
    });

    it('should accept custom dimension options', () => {
      const img = createMockImage(100, 100);
      const result = validateImageDimensions(img, {
        minWidth: 50,
        minHeight: 50,
        maxWidth: 200,
        maxHeight: 200,
      });
      expect(result.valid).toBe(true);
    });
  });

  // ─── getFileExtension ──────────────────────────────────────
  describe('getFileExtension', () => {
    it('should return extension for normal filename', () => {
      expect(getFileExtension('photo.jpg')).toBe('jpg');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('photo.JPG')).toBe('jpg');
    });

    it('should return last extension for multiple dots', () => {
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('README')).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(getFileExtension(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(getFileExtension(undefined)).toBe('');
    });
  });

  // ─── formatFileSize ────────────────────────────────────────
  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format fractional values', () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should return 0 B for zero', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should return 0 B for negative numbers', () => {
      expect(formatFileSize(-100)).toBe('0 B');
    });

    it('should return 0 B for non-number', () => {
      expect(formatFileSize('abc')).toBe('0 B');
    });

    it('should return 0 B for null', () => {
      expect(formatFileSize(null)).toBe('0 B');
    });
  });
});
