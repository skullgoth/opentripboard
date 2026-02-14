import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/state/preferences-state.js', () => ({
  getPreferences: vi.fn(() => ({
    language: 'en',
    dateFormat: 'mdy',
    timeFormat: '12h',
    distanceFormat: 'mi',
  })),
}));

import {
  formatDate,
  formatDateWithYear,
  formatDateLong,
  formatTime,
  formatDateTime,
  formatDistance,
  formatDistancePrecise,
  getDistanceUnit,
  convertDistance,
  getFormatExamples,
} from '../../../src/utils/formatters.js';

describe('Formatters', () => {
  const testDate = new Date(2025, 2, 21, 14, 30); // March 21, 2025 2:30 PM
  const enUsPrefs = { language: 'en', dateFormat: 'mdy', timeFormat: '12h', distanceFormat: 'mi' };
  const frPrefs = { language: 'fr', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' };

  describe('formatDate', () => {
    it('should format date in US format', () => {
      const result = formatDate(testDate, enUsPrefs);
      expect(result).toMatch(/3\/21/);
    });

    it('should format date in French format', () => {
      const result = formatDate(testDate, frPrefs);
      expect(result).toMatch(/21\/03/);
    });

    it('should return Invalid Date for bad input', () => {
      expect(formatDate('not-a-date', enUsPrefs)).toBe('Invalid Date');
    });

    it('should accept string dates', () => {
      const result = formatDate('2025-03-21T14:30:00', enUsPrefs);
      expect(result).toBeDefined();
      expect(result).not.toBe('Invalid Date');
    });
  });

  describe('formatDateWithYear', () => {
    it('should include year in formatted date', () => {
      const result = formatDateWithYear(testDate, enUsPrefs);
      expect(result).toContain('2025');
    });

    it('should return Invalid Date for bad input', () => {
      expect(formatDateWithYear('invalid', enUsPrefs)).toBe('Invalid Date');
    });
  });

  describe('formatDateLong', () => {
    it('should format date in long US format', () => {
      const result = formatDateLong(testDate, enUsPrefs);
      expect(result).toContain('March');
      expect(result).toContain('2025');
    });

    it('should format date in long French format', () => {
      const result = formatDateLong(testDate, frPrefs);
      expect(result).toContain('mars');
      expect(result).toContain('2025');
    });

    it('should return Invalid Date for bad input', () => {
      expect(formatDateLong('invalid', enUsPrefs)).toBe('Invalid Date');
    });
  });

  describe('formatTime', () => {
    it('should format time in 12h format', () => {
      const result = formatTime(testDate, { timeFormat: '12h' });
      expect(result).toMatch(/2:30\s?PM/);
    });

    it('should format time in 24h format', () => {
      const result = formatTime(testDate, { timeFormat: '24h' });
      expect(result).toMatch(/14:30/);
    });

    it('should return Invalid Time for bad input', () => {
      expect(formatTime('invalid', enUsPrefs)).toBe('Invalid Time');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const result = formatDateTime(testDate, enUsPrefs);
      expect(result).toContain('2025');
      expect(result).toMatch(/2:30/);
    });

    it('should return Invalid Date for bad input', () => {
      expect(formatDateTime('invalid', enUsPrefs)).toBe('Invalid Date');
    });
  });

  describe('formatDistance', () => {
    it('should format in miles when distanceFormat is mi', () => {
      const result = formatDistance(10, { distanceFormat: 'mi' });
      expect(result).toContain('mi');
      expect(result).toMatch(/6\.2/);
    });

    it('should format in km when distanceFormat is km', () => {
      const result = formatDistance(10, { distanceFormat: 'km' });
      expect(result).toBe('10.0 km');
    });

    it('should return Invalid Distance for non-number', () => {
      expect(formatDistance('abc', enUsPrefs)).toBe('Invalid Distance');
    });

    it('should return Invalid Distance for NaN', () => {
      expect(formatDistance(NaN, enUsPrefs)).toBe('Invalid Distance');
    });
  });

  describe('formatDistancePrecise', () => {
    it('should format with specified decimal places', () => {
      const result = formatDistancePrecise(10.123, 3, { distanceFormat: 'km' });
      expect(result).toBe('10.123 km');
    });

    it('should default to 2 decimal places', () => {
      const result = formatDistancePrecise(10.1, undefined, { distanceFormat: 'km' });
      expect(result).toBe('10.10 km');
    });

    it('should convert to miles when needed', () => {
      const result = formatDistancePrecise(10, 2, { distanceFormat: 'mi' });
      expect(result).toContain('mi');
    });

    it('should return Invalid Distance for non-number', () => {
      expect(formatDistancePrecise('abc', 2, enUsPrefs)).toBe('Invalid Distance');
    });
  });

  describe('getDistanceUnit', () => {
    it('should return mi for mile preference', () => {
      expect(getDistanceUnit({ distanceFormat: 'mi' })).toBe('mi');
    });

    it('should return km for km preference', () => {
      expect(getDistanceUnit({ distanceFormat: 'km' })).toBe('km');
    });
  });

  describe('convertDistance', () => {
    it('should convert to miles', () => {
      const result = convertDistance(10, { distanceFormat: 'mi' });
      expect(result).toBeCloseTo(6.21371, 4);
    });

    it('should keep km for km preference', () => {
      const result = convertDistance(10, { distanceFormat: 'km' });
      expect(result).toBe(10);
    });

    it('should return 0 for non-number', () => {
      expect(convertDistance('abc', enUsPrefs)).toBe(0);
    });

    it('should return 0 for NaN', () => {
      expect(convertDistance(NaN, enUsPrefs)).toBe(0);
    });
  });

  describe('getFormatExamples', () => {
    it('should return example formatted values', () => {
      const examples = getFormatExamples(enUsPrefs);
      expect(examples.date).toBeDefined();
      expect(examples.dateWithYear).toBeDefined();
      expect(examples.time).toBeDefined();
      expect(examples.distance).toBeDefined();
    });
  });
});
