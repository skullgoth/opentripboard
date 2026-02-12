/**
 * Unit tests for Date Helper Utilities
 * Tests all functions from src/utils/date-helpers.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock preferences-state to control locale and format
vi.mock('../../../src/state/preferences-state.js', () => ({
  getPreferences: vi.fn(() => ({
    language: 'en',
    dateFormat: 'mdy',
    timeFormat: '12h',
    distanceFormat: 'mi',
  })),
}));

import { getPreferences } from '../../../src/state/preferences-state.js';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDateForInput,
  formatDateTimeForInput,
  calculateDuration,
  formatDuration,
  getRelativeTime,
  isPast,
  isFuture,
  isToday,
} from '../../../src/utils/date-helpers.js';

describe('Date Helpers', () => {
  // ─── formatDate ────────────────────────────────────────────
  describe('formatDate', () => {
    it('should format a date with medium format by default', () => {
      const result = formatDate('2025-06-15T12:00:00Z');
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should format with short format', () => {
      const result = formatDate('2025-06-15T12:00:00Z', 'short');
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should format with long format', () => {
      const result = formatDate('2025-06-15T12:00:00Z', 'long');
      expect(result).toBeTruthy();
      expect(result.toLowerCase()).toContain('june');
    });

    it('should format with full format', () => {
      const result = formatDate('2025-06-15T12:00:00Z', 'full');
      expect(result).toBeTruthy();
      // Full format includes weekday
      expect(result.length).toBeGreaterThan(10);
    });

    it('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(formatDate('')).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatDate('not-a-date')).toBe('');
    });

    it('should accept Date objects', () => {
      const result = formatDate(new Date(2025, 5, 15));
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should respect dmy date format preference', () => {
      getPreferences.mockReturnValue({
        language: 'en',
        dateFormat: 'dmy',
        timeFormat: '12h',
      });

      const result = formatDate('2025-06-15T12:00:00Z', 'medium');
      expect(result).toBeTruthy();

      // Reset mock
      getPreferences.mockReturnValue({
        language: 'en',
        dateFormat: 'mdy',
        timeFormat: '12h',
      });
    });
  });

  // ─── formatDateTime ────────────────────────────────────────
  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const result = formatDateTime('2025-06-15T14:30:00Z');
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should return empty string for null', () => {
      expect(formatDateTime(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDateTime(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(formatDateTime('')).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatDateTime('not-a-date')).toBe('');
    });
  });

  // ─── formatTime ────────────────────────────────────────────
  describe('formatTime', () => {
    it('should format time in 12h format by default', () => {
      const result = formatTime('2025-06-15T14:30:00Z');
      expect(result).toBeTruthy();
    });

    it('should return Invalid Time for invalid date', () => {
      expect(formatTime('not-a-date')).toBe('Invalid Time');
    });

    it('should respect 24h format preference', () => {
      getPreferences.mockReturnValue({
        language: 'en',
        dateFormat: 'mdy',
        timeFormat: '24h',
      });

      const result = formatTime('2025-06-15T14:30:00Z');
      expect(result).toBeTruthy();

      // Reset mock
      getPreferences.mockReturnValue({
        language: 'en',
        dateFormat: 'mdy',
        timeFormat: '12h',
      });
    });
  });

  // ─── formatDateForInput ────────────────────────────────────
  describe('formatDateForInput', () => {
    it('should format as YYYY-MM-DD', () => {
      // Use a local date to avoid timezone-shifting the date
      const result = formatDateForInput(new Date(2025, 5, 15));
      expect(result).toBe('2025-06-15');
    });

    it('should pad month and day with zeros', () => {
      const result = formatDateForInput(new Date(2025, 0, 5));
      expect(result).toBe('2025-01-05');
    });

    it('should return empty string for null', () => {
      expect(formatDateForInput(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDateForInput(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(formatDateForInput('')).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatDateForInput('not-a-date')).toBe('');
    });
  });

  // ─── formatDateTimeForInput ────────────────────────────────
  describe('formatDateTimeForInput', () => {
    it('should format as YYYY-MM-DDTHH:mm', () => {
      const result = formatDateTimeForInput(new Date(2025, 5, 15, 14, 30));
      expect(result).toBe('2025-06-15T14:30');
    });

    it('should pad hours and minutes with zeros', () => {
      const result = formatDateTimeForInput(new Date(2025, 0, 5, 8, 5));
      expect(result).toBe('2025-01-05T08:05');
    });

    it('should return empty string for null', () => {
      expect(formatDateTimeForInput(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(formatDateTimeForInput(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(formatDateTimeForInput('')).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatDateTimeForInput('not-a-date')).toBe('');
    });
  });

  // ─── calculateDuration ─────────────────────────────────────
  describe('calculateDuration', () => {
    it('should calculate days, hours, minutes between two dates', () => {
      const result = calculateDuration(
        '2025-06-01T10:00:00Z',
        '2025-06-03T14:30:00Z',
      );
      expect(result.days).toBe(2);
      expect(result.hours).toBe(4);
      expect(result.minutes).toBe(30);
    });

    it('should return zero duration for same date', () => {
      const result = calculateDuration(
        '2025-06-01T10:00:00Z',
        '2025-06-01T10:00:00Z',
      );
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it('should return zero for negative duration', () => {
      const result = calculateDuration(
        '2025-06-03T10:00:00Z',
        '2025-06-01T10:00:00Z',
      );
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });

    it('should handle hours-only duration', () => {
      const result = calculateDuration(
        '2025-06-01T10:00:00Z',
        '2025-06-01T15:45:00Z',
      );
      expect(result.days).toBe(0);
      expect(result.hours).toBe(5);
      expect(result.minutes).toBe(45);
    });
  });

  // ─── formatDuration ────────────────────────────────────────
  describe('formatDuration', () => {
    it('should format days, hours, minutes', () => {
      const result = formatDuration({ days: 2, hours: 3, minutes: 30 });
      expect(result).toBe('2 days, 3 hours, 30 minutes');
    });

    it('should use singular forms', () => {
      const result = formatDuration({ days: 1, hours: 1, minutes: 1 });
      expect(result).toBe('1 day, 1 hour, 1 minute');
    });

    it('should omit zero days', () => {
      const result = formatDuration({ days: 0, hours: 5, minutes: 30 });
      expect(result).toBe('5 hours, 30 minutes');
    });

    it('should omit zero hours', () => {
      const result = formatDuration({ days: 3, hours: 0, minutes: 15 });
      expect(result).toBe('3 days, 15 minutes');
    });

    it('should show 0 minutes when all zeros', () => {
      const result = formatDuration({ days: 0, hours: 0, minutes: 0 });
      expect(result).toBe('0 minutes');
    });

    it('should omit zero minutes when days or hours present', () => {
      const result = formatDuration({ days: 1, hours: 2, minutes: 0 });
      expect(result).toBe('1 day, 2 hours');
    });
  });

  // ─── getRelativeTime ───────────────────────────────────────
  describe('getRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "just now" for very recent dates', () => {
      expect(getRelativeTime('2025-06-15T11:59:45Z')).toBe('just now');
    });

    it('should return minutes ago', () => {
      expect(getRelativeTime('2025-06-15T11:55:00Z')).toBe('5 minutes ago');
    });

    it('should return singular minute ago', () => {
      expect(getRelativeTime('2025-06-15T11:59:00Z')).toBe('1 minute ago');
    });

    it('should return hours ago', () => {
      expect(getRelativeTime('2025-06-15T09:00:00Z')).toBe('3 hours ago');
    });

    it('should return singular hour ago', () => {
      expect(getRelativeTime('2025-06-15T11:00:00Z')).toBe('1 hour ago');
    });

    it('should return days ago', () => {
      expect(getRelativeTime('2025-06-13T12:00:00Z')).toBe('2 days ago');
    });

    it('should return weeks ago', () => {
      expect(getRelativeTime('2025-06-01T12:00:00Z')).toBe('2 weeks ago');
    });

    it('should return months ago', () => {
      expect(getRelativeTime('2025-03-15T12:00:00Z')).toBe('3 months ago');
    });

    it('should return years ago', () => {
      expect(getRelativeTime('2023-06-15T12:00:00Z')).toBe('2 years ago');
    });

    it('should return future time with "in" prefix', () => {
      expect(getRelativeTime('2025-06-17T12:00:00Z')).toBe('in 2 days');
    });

    it('should return "Invalid Date" for invalid input', () => {
      expect(getRelativeTime('not-a-date')).toBe('Invalid Date');
    });
  });

  // ─── isPast ────────────────────────────────────────────────
  describe('isPast', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for past date', () => {
      expect(isPast('2025-06-14T12:00:00Z')).toBe(true);
    });

    it('should return false for future date', () => {
      expect(isPast('2025-06-16T12:00:00Z')).toBe(false);
    });
  });

  // ─── isFuture ──────────────────────────────────────────────
  describe('isFuture', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for future date', () => {
      expect(isFuture('2025-06-16T12:00:00Z')).toBe(true);
    });

    it('should return false for past date', () => {
      expect(isFuture('2025-06-14T12:00:00Z')).toBe(false);
    });
  });

  // ─── isToday ───────────────────────────────────────────────
  describe('isToday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for today', () => {
      expect(isToday('2025-06-15T08:00:00Z')).toBe(true);
    });

    it('should return false for yesterday', () => {
      expect(isToday('2025-06-14T12:00:00Z')).toBe(false);
    });

    it('should return false for tomorrow', () => {
      expect(isToday('2025-06-16T12:00:00Z')).toBe(false);
    });
  });
});
