import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidFileExtension,
  isValidMimeType,
  generateUniqueFilename,
} from '../../../src/middleware/upload.js';

describe('Upload Middleware', () => {
  describe('isValidFileExtension', () => {
    it('should accept .jpg files', () => {
      expect(isValidFileExtension('photo.jpg')).toBe(true);
    });

    it('should accept .jpeg files', () => {
      expect(isValidFileExtension('photo.jpeg')).toBe(true);
    });

    it('should accept .png files', () => {
      expect(isValidFileExtension('photo.png')).toBe(true);
    });

    it('should accept .webp files', () => {
      expect(isValidFileExtension('photo.webp')).toBe(true);
    });

    it('should reject .gif files', () => {
      expect(isValidFileExtension('photo.gif')).toBe(false);
    });

    it('should reject .pdf files', () => {
      expect(isValidFileExtension('doc.pdf')).toBe(false);
    });

    it('should reject .exe files', () => {
      expect(isValidFileExtension('virus.exe')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidFileExtension('photo.JPG')).toBe(true);
      expect(isValidFileExtension('photo.PNG')).toBe(true);
    });
  });

  describe('isValidMimeType', () => {
    it('should accept image/jpeg', () => {
      expect(isValidMimeType('image/jpeg')).toBe(true);
    });

    it('should accept image/png', () => {
      expect(isValidMimeType('image/png')).toBe(true);
    });

    it('should accept image/webp', () => {
      expect(isValidMimeType('image/webp')).toBe(true);
    });

    it('should reject image/gif', () => {
      expect(isValidMimeType('image/gif')).toBe(false);
    });

    it('should reject application/pdf', () => {
      expect(isValidMimeType('application/pdf')).toBe(false);
    });

    it('should reject text/html', () => {
      expect(isValidMimeType('text/html')).toBe(false);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should preserve file extension', () => {
      const filename = generateUniqueFilename('photo.jpg');
      expect(filename).toMatch(/\.jpg$/);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const filename = generateUniqueFilename('photo.png');
      const after = Date.now();
      const timestamp = parseInt(filename.split('-')[0]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate unique filenames', () => {
      const name1 = generateUniqueFilename('photo.jpg');
      const name2 = generateUniqueFilename('photo.jpg');
      expect(name1).not.toBe(name2);
    });

    it('should lowercase the extension', () => {
      const filename = generateUniqueFilename('photo.JPG');
      expect(filename).toMatch(/\.jpg$/);
    });
  });
});
