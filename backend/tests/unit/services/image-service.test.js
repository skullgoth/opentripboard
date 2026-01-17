/**
 * Unit tests for Image Service
 * Tests all image processing business logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as imageService from '../../../src/services/image-service.js';

// Mock sharp library
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 2000,
      height: 1500,
      format: 'jpeg',
      size: 500000,
    }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue({
      width: 1200,
      height: 630,
      format: 'jpeg',
      size: 150000,
    }),
  }));
  return { default: mockSharp };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    unlink: vi.fn().mockResolvedValue(),
  },
}));

describe('Image Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processCoverImage', () => {
    it('should process cover image successfully', async () => {
      const inputPath = '/uploads/original.jpg';
      const outputPath = '/uploads/cover.jpg';
      const options = { width: 1200, height: 630, format: 'jpeg', quality: 85 };

      const result = await imageService.processCoverImage(inputPath, outputPath, options);

      expect(result).toBeDefined();
      expect(result.width).toBe(1200);
      expect(result.height).toBe(630);
      expect(result.format).toBe('jpeg');
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail successfully', async () => {
      const inputPath = '/uploads/cover.jpg';
      const outputPath = '/uploads/thumb.jpg';
      const options = { width: 400, height: 210, format: 'jpeg' };

      const result = await imageService.generateThumbnail(inputPath, outputPath, options);

      expect(result).toBeDefined();
      expect(result.width).toBeDefined();
      expect(result.height).toBeDefined();
    });
  });

  describe('optimizeImage', () => {
    it('should optimize image successfully', async () => {
      const inputPath = '/uploads/image.jpg';
      const outputPath = '/uploads/optimized.jpg';
      const options = { quality: 85 };

      const result = await imageService.optimizeImage(inputPath, outputPath, options);

      expect(result).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.savings).toBeDefined();
    });
  });

  describe('getImageMetadata', () => {
    it('should get image metadata successfully', async () => {
      const imagePath = '/uploads/image.jpg';

      const result = await imageService.getImageMetadata(imagePath);

      expect(result).toBeDefined();
      expect(result.width).toBe(2000);
      expect(result.height).toBe(1500);
      expect(result.format).toBe('jpeg');
    });
  });

  describe('validateImage', () => {
    it('should validate image dimensions and format successfully', async () => {
      const imagePath = '/uploads/image.jpg';
      const constraints = {
        minWidth: 800,
        minHeight: 600,
        maxWidth: 3000,
        maxHeight: 2000,
        allowedFormats: ['jpeg', 'png', 'webp'],
      };

      const result = await imageService.validateImage(imagePath, constraints);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata).toBeDefined();
    });

    it('should return validation errors for invalid image', async () => {
      const imagePath = '/uploads/image.jpg';
      const constraints = {
        minWidth: 3000,
        minHeight: 2500,
      };

      const result = await imageService.validateImage(imagePath, constraints);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      const imagePath = '/uploads/image.jpg';

      await imageService.deleteImage(imagePath);

      const fs = await import('fs/promises');
      expect(fs.default.unlink).toHaveBeenCalledWith(imagePath);
    });

    it('should handle non-existent file gracefully', async () => {
      const imagePath = '/uploads/nonexistent.jpg';

      const fs = await import('fs/promises');
      vi.mocked(fs.default.unlink).mockRejectedValueOnce({ code: 'ENOENT' });

      await expect(imageService.deleteImage(imagePath)).resolves.not.toThrow();
    });
  });
});
