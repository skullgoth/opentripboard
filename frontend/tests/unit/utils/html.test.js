import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../src/utils/html.js';

describe('HTML Utility', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const result = escapeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should escape ampersands', () => {
      const result = escapeHtml('foo & bar');
      expect(result).toBe('foo &amp; bar');
    });

    it('should handle strings with quotes', () => {
      const result = escapeHtml('"hello"');
      // textContent/innerHTML approach doesn't escape quotes in text nodes
      expect(result).toBe('"hello"');
    });

    it('should return empty string for null', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify plain text', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });
});
