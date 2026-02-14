import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/i18n.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../../../src/utils/category-resolver.js', () => ({
  buildCategoryOptions: vi.fn(() => []),
  getCategoryIcon: vi.fn(() => '📄'),
  getCategoryName: vi.fn(() => 'Other'),
}));

vi.mock('../../../src/state/categories-state.js', () => ({
  getCategories: vi.fn(() => ({
    defaults: { document: [] },
    custom: { document: [] },
  })),
}));

import {
  formatFileSize,
  getFileIcon,
  getCategoryColor,
  getAllowedFileTypes,
  getAllowedMimeTypes,
  validateFile,
} from '../../../src/utils/documents.js';

describe('Documents Utility', () => {
  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
    });

    it('should format with decimal precision', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('getFileIcon', () => {
    it('should return pdf for PDF files', () => {
      expect(getFileIcon('application/pdf')).toBe('pdf');
    });

    it('should return image for image files', () => {
      expect(getFileIcon('image/jpeg')).toBe('image');
      expect(getFileIcon('image/png')).toBe('image');
    });

    it('should return doc for Word documents', () => {
      expect(getFileIcon('application/msword')).toBe('doc');
    });

    it('should return text for plain text', () => {
      expect(getFileIcon('text/plain')).toBe('text');
    });

    it('should return file for unknown types', () => {
      expect(getFileIcon('application/octet-stream')).toBe('file');
    });
  });

  describe('getCategoryColor', () => {
    it('should return blue for passport', () => {
      expect(getCategoryColor('passport')).toBe('blue');
    });

    it('should return purple for visa', () => {
      expect(getCategoryColor('visa')).toBe('purple');
    });

    it('should return gray for unknown', () => {
      expect(getCategoryColor('unknown')).toBe('gray');
    });
  });

  describe('getAllowedFileTypes', () => {
    it('should return accept attribute string', () => {
      const types = getAllowedFileTypes();
      expect(types).toContain('.pdf');
      expect(types).toContain('.jpg');
      expect(types).toContain('.png');
      expect(types).toContain('.txt');
    });
  });

  describe('getAllowedMimeTypes', () => {
    it('should return array of MIME types', () => {
      const types = getAllowedMimeTypes();
      expect(types).toContain('application/pdf');
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
      expect(types).toContain('text/plain');
    });
  });

  describe('validateFile', () => {
    it('should reject null file', () => {
      const result = validateFile(null);
      expect(result.valid).toBe(false);
    });

    it('should reject file too large', () => {
      const file = { size: 11 * 1024 * 1024, type: 'application/pdf' };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid MIME type', () => {
      const file = { size: 1024, type: 'application/javascript' };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });

    it('should accept valid file', () => {
      const file = { size: 1024, type: 'application/pdf' };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });
});
