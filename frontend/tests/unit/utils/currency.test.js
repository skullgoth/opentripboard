/**
 * Unit tests for Currency Formatting Utilities
 * Tests all 7 pure functions from src/utils/currency.js
 */

import { describe, it, expect } from 'vitest';
import {
  getCurrencySymbol,
  formatCurrency,
  formatCompactCurrency,
  parseCurrency,
  getCommonCurrencies,
  formatPercentage,
  calculatePercentage,
} from '../../../src/utils/currency.js';

describe('Currency', () => {
  // ─── getCurrencySymbol ─────────────────────────────────────
  describe('getCurrencySymbol', () => {
    it('should return $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return € for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return £ for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should handle lowercase currency codes', () => {
      expect(getCurrencySymbol('usd')).toBe('$');
    });

    it('should return the code itself for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });

    it('should return $ for null/undefined', () => {
      expect(getCurrencySymbol(null)).toBe('$');
      expect(getCurrencySymbol(undefined)).toBe('$');
    });
  });

  // ─── formatCurrency ────────────────────────────────────────
  describe('formatCurrency', () => {
    it('should format a basic USD amount', () => {
      const result = formatCurrency(19.99, 'USD');
      expect(result).toContain('19.99');
    });

    it('should format EUR amount', () => {
      const result = formatCurrency(100, 'EUR');
      expect(result).toContain('100.00');
    });

    it('should handle null amount', () => {
      const result = formatCurrency(null, 'USD');
      expect(result).toContain('0.00');
    });

    it('should handle undefined amount', () => {
      const result = formatCurrency(undefined, 'USD');
      expect(result).toContain('0.00');
    });

    it('should handle string amounts', () => {
      const result = formatCurrency('42.50', 'USD');
      expect(result).toContain('42.50');
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(-25.00, 'USD');
      expect(result).toContain('25.00');
    });

    it('should default to USD when no currency specified', () => {
      const result = formatCurrency(10);
      expect(result).toContain('10.00');
    });

    it('should respect custom fraction digits', () => {
      const result = formatCurrency(10, 'USD', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      expect(result).toContain('10');
      expect(result).not.toContain('10.00');
    });
  });

  // ─── formatCompactCurrency ─────────────────────────────────
  describe('formatCompactCurrency', () => {
    it('should format small amounts normally', () => {
      expect(formatCompactCurrency(42.50, 'USD')).toBe('$42.50');
    });

    it('should format thousands with K suffix', () => {
      expect(formatCompactCurrency(1500, 'USD')).toBe('$1.5K');
    });

    it('should format millions with M suffix', () => {
      expect(formatCompactCurrency(2500000, 'USD')).toBe('$2.5M');
    });

    it('should handle negative amounts', () => {
      expect(formatCompactCurrency(-1500, 'USD')).toBe('-$1.5K');
    });

    it('should handle null amount', () => {
      expect(formatCompactCurrency(null, 'EUR')).toBe('€0');
    });

    it('should handle undefined amount', () => {
      expect(formatCompactCurrency(undefined, 'EUR')).toBe('€0');
    });

    it('should handle string amounts', () => {
      expect(formatCompactCurrency('2000', 'USD')).toBe('$2.0K');
    });

    it('should use correct currency symbol', () => {
      expect(formatCompactCurrency(100, 'EUR')).toBe('€100.00');
    });

    it('should format exactly 1000 with K', () => {
      expect(formatCompactCurrency(1000, 'USD')).toBe('$1.0K');
    });

    it('should format exactly 1000000 with M', () => {
      expect(formatCompactCurrency(1000000, 'USD')).toBe('$1.0M');
    });
  });

  // ─── parseCurrency ─────────────────────────────────────────
  describe('parseCurrency', () => {
    it('should parse a number as-is', () => {
      expect(parseCurrency(42.50)).toBe(42.50);
    });

    it('should parse a plain numeric string', () => {
      expect(parseCurrency('42.50')).toBe(42.50);
    });

    it('should strip currency symbols', () => {
      expect(parseCurrency('$42.50')).toBe(42.50);
    });

    it('should strip euro symbol', () => {
      expect(parseCurrency('€100.00')).toBe(100);
    });

    it('should handle negative values', () => {
      expect(parseCurrency('-$25.00')).toBe(-25);
    });

    it('should return 0 for null', () => {
      expect(parseCurrency(null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect(parseCurrency(undefined)).toBe(0);
    });

    it('should return 0 for empty string', () => {
      expect(parseCurrency('')).toBe(0);
    });

    it('should return 0 for non-parseable string', () => {
      expect(parseCurrency('abc')).toBe(0);
    });
  });

  // ─── getCommonCurrencies ───────────────────────────────────
  describe('getCommonCurrencies', () => {
    it('should return an array of currencies', () => {
      const currencies = getCommonCurrencies();
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
    });

    it('should include USD as first currency', () => {
      const currencies = getCommonCurrencies();
      expect(currencies[0].code).toBe('USD');
    });

    it('should have code, name, and symbol for each entry', () => {
      const currencies = getCommonCurrencies();
      currencies.forEach((currency) => {
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('name');
        expect(currency).toHaveProperty('symbol');
      });
    });

    it('should include EUR', () => {
      const currencies = getCommonCurrencies();
      expect(currencies.find((c) => c.code === 'EUR')).toBeDefined();
    });
  });

  // ─── formatPercentage ──────────────────────────────────────
  describe('formatPercentage', () => {
    it('should format integer percentage', () => {
      expect(formatPercentage(75)).toBe('75%');
    });

    it('should format with decimal places', () => {
      expect(formatPercentage(33.333, 1)).toBe('33.3%');
    });

    it('should format zero', () => {
      expect(formatPercentage(0)).toBe('0%');
    });

    it('should handle null', () => {
      expect(formatPercentage(null)).toBe('0%');
    });

    it('should handle undefined', () => {
      expect(formatPercentage(undefined)).toBe('0%');
    });

    it('should format 100%', () => {
      expect(formatPercentage(100)).toBe('100%');
    });

    it('should format with 2 decimal places', () => {
      expect(formatPercentage(66.6667, 2)).toBe('66.67%');
    });
  });

  // ─── calculatePercentage ───────────────────────────────────
  describe('calculatePercentage', () => {
    it('should calculate simple percentage', () => {
      expect(calculatePercentage(50, 200)).toBe(25);
    });

    it('should return 100 for value equal to total', () => {
      expect(calculatePercentage(100, 100)).toBe(100);
    });

    it('should cap at 100 when value exceeds total', () => {
      expect(calculatePercentage(150, 100)).toBe(100);
    });

    it('should return 0 when value is 0', () => {
      expect(calculatePercentage(0, 100)).toBe(0);
    });

    it('should return 0 for zero total', () => {
      expect(calculatePercentage(50, 0)).toBe(0);
    });

    it('should return 0 for null total', () => {
      expect(calculatePercentage(50, null)).toBe(0);
    });

    it('should clamp negative values to 0', () => {
      expect(calculatePercentage(-10, 100)).toBe(0);
    });
  });
});
