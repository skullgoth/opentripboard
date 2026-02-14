import { describe, it, expect } from 'vitest';
import {
  isValidDocumentExtension,
  isValidDocumentMimeType,
  generateUniqueFilename,
  formatFileSize,
  getFileIcon,
} from '../../../src/middleware/document-upload.js';

describe('Document Upload Middleware', () => {
  describe('isValidDocumentExtension', () => {
    it('should accept .pdf files', () => {
      expect(isValidDocumentExtension('doc.pdf')).toBe(true);
    });

    it('should accept .doc files', () => {
      expect(isValidDocumentExtension('doc.doc')).toBe(true);
    });

    it('should accept .docx files', () => {
      expect(isValidDocumentExtension('doc.docx')).toBe(true);
    });

    it('should accept image files', () => {
      expect(isValidDocumentExtension('photo.jpg')).toBe(true);
      expect(isValidDocumentExtension('photo.jpeg')).toBe(true);
      expect(isValidDocumentExtension('photo.png')).toBe(true);
      expect(isValidDocumentExtension('photo.webp')).toBe(true);
      expect(isValidDocumentExtension('photo.gif')).toBe(true);
    });

    it('should accept .txt files', () => {
      expect(isValidDocumentExtension('notes.txt')).toBe(true);
    });

    it('should reject .exe files', () => {
      expect(isValidDocumentExtension('virus.exe')).toBe(false);
    });

    it('should reject .js files', () => {
      expect(isValidDocumentExtension('script.js')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidDocumentExtension('doc.PDF')).toBe(true);
      expect(isValidDocumentExtension('doc.DOCX')).toBe(true);
    });
  });

  describe('isValidDocumentMimeType', () => {
    it('should accept application/pdf', () => {
      expect(isValidDocumentMimeType('application/pdf')).toBe(true);
    });

    it('should accept Word documents', () => {
      expect(isValidDocumentMimeType('application/msword')).toBe(true);
      expect(
        isValidDocumentMimeType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe(true);
    });

    it('should accept image types', () => {
      expect(isValidDocumentMimeType('image/jpeg')).toBe(true);
      expect(isValidDocumentMimeType('image/png')).toBe(true);
      expect(isValidDocumentMimeType('image/webp')).toBe(true);
      expect(isValidDocumentMimeType('image/gif')).toBe(true);
    });

    it('should accept text/plain', () => {
      expect(isValidDocumentMimeType('text/plain')).toBe(true);
    });

    it('should reject text/html', () => {
      expect(isValidDocumentMimeType('text/html')).toBe(false);
    });

    it('should reject application/javascript', () => {
      expect(isValidDocumentMimeType('application/javascript')).toBe(false);
    });
  });

  describe('generateUniqueFilename', () => {
    it('should preserve file extension', () => {
      const filename = generateUniqueFilename('document.pdf');
      expect(filename).toMatch(/\.pdf$/);
    });

    it('should generate unique filenames', () => {
      const name1 = generateUniqueFilename('doc.pdf');
      const name2 = generateUniqueFilename('doc.pdf');
      expect(name1).not.toBe(name2);
    });

    it('should lowercase extension', () => {
      const filename = generateUniqueFilename('doc.PDF');
      expect(filename).toMatch(/\.pdf$/);
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
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
      expect(
        getFileIcon(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe('doc');
    });

    it('should return text for plain text', () => {
      expect(getFileIcon('text/plain')).toBe('text');
    });

    it('should return file for unknown types', () => {
      expect(getFileIcon('application/octet-stream')).toBe('file');
    });
  });
});
