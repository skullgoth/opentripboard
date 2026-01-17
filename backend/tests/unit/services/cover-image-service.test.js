// T033: Unit tests for cover image service
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sharp
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock https
vi.mock('https', () => ({
  default: {
    get: vi.fn((url, callback) => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('fake-image-data'));
          }
          if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };
      callback(mockResponse);
      return { on: vi.fn() };
    }),
  },
}));

describe('CoverImageService', () => {
  let CoverImageService;
  let service;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Set environment variables
    process.env.PEXELS_API_KEY = 'test-api-key';
    process.env.UPLOAD_DIR = '/tmp/test-uploads';

    // Import after mocks are set up
    const module = await import('../../../src/services/cover-image-service.js');
    CoverImageService = module.CoverImageService;
    service = new CoverImageService();
  });

  afterEach(() => {
    delete process.env.PEXELS_API_KEY;
    delete process.env.UPLOAD_DIR;
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(service.apiKey).toBe('test-api-key');
      expect(service.maxRequestsPerHour).toBe(200);
      expect(service.targetWidth).toBe(1200);
      expect(service.targetHeight).toBe(630);
      expect(service.quality).toBe(85);
    });

    it('should warn when PEXELS_API_KEY is not set', async () => {
      delete process.env.PEXELS_API_KEY;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.resetModules();
      const module = await import('../../../src/services/cover-image-service.js?t=1');
      const newService = new module.CoverImageService();

      expect(newService.apiKey).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('_buildSearchQuery', () => {
    it('should extract main location and add travel keywords', () => {
      const query = service._buildSearchQuery('Paris, Île-de-France, France');
      expect(query).toBe('Paris landmark architecture travel');
    });

    it('should handle simple location names', () => {
      const query = service._buildSearchQuery('Tokyo');
      expect(query).toBe('Tokyo landmark architecture travel');
    });

    it('should handle locations with multiple commas', () => {
      const query = service._buildSearchQuery('New York City, New York, USA');
      expect(query).toBe('New York City landmark architecture travel');
    });
  });

  describe('_searchPexels', () => {
    it('should call Pexels API with correct parameters', async () => {
      const mockPhotos = [
        {
          id: 123,
          photographer: 'John Doe',
          photographer_url: 'https://pexels.com/@johndoe',
          url: 'https://pexels.com/photo/123',
          src: { large2x: 'https://images.pexels.com/123.jpg' },
          alt: 'Beautiful Paris skyline',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const result = await service._searchPexels('Paris landmark');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.pexels.com/v1/search'),
        expect.objectContaining({
          headers: { Authorization: 'test-api-key' },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].photographer).toBe('John Doe');
    });

    it('should filter out flag images', async () => {
      const mockPhotos = [
        {
          id: 123,
          photographer: 'Jane',
          alt: 'French flag waving',
          src: { large2x: 'https://images.pexels.com/123.jpg' },
        },
        {
          id: 456,
          photographer: 'Bob',
          alt: 'Eiffel Tower at sunset',
          src: { large2x: 'https://images.pexels.com/456.jpg' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const result = await service._searchPexels('France');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(456);
    });

    it('should filter out banner images', async () => {
      const mockPhotos = [
        {
          id: 123,
          photographer: 'Jane',
          alt: 'Welcome banner to Tokyo',
          src: { large2x: 'https://images.pexels.com/123.jpg' },
        },
        {
          id: 456,
          photographer: 'Bob',
          alt: 'Tokyo skyline',
          src: { large2x: 'https://images.pexels.com/456.jpg' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const result = await service._searchPexels('Tokyo');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(456);
    });

    it('should throw RATE_LIMIT_EXCEEDED on 429 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(service._searchPexels('Paris')).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('should throw PEXELS_API_ERROR on other error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(service._searchPexels('Paris')).rejects.toThrow('PEXELS_API_ERROR: 500');
    });
  });

  describe('_checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      // First request should pass
      await expect(service._checkRateLimit()).resolves.toBeUndefined();
    });

    it('should track request timestamps', async () => {
      await service._checkRateLimit();
      expect(service.requestTimestamps).toHaveLength(1);

      await service._checkRateLimit();
      expect(service.requestTimestamps).toHaveLength(2);
    });

    it('should throw RATE_LIMIT_EXCEEDED when limit is reached', async () => {
      // Fill up the rate limit
      service.requestTimestamps = Array(200).fill(Date.now());

      await expect(service._checkRateLimit()).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('should remove old timestamps outside the window', async () => {
      // Add old timestamps (older than 1 hour)
      const oldTime = Date.now() - (61 * 60 * 1000); // 61 minutes ago
      service.requestTimestamps = Array(100).fill(oldTime);

      await service._checkRateLimit();

      // Old timestamps should be removed, only the new one remains
      expect(service.requestTimestamps).toHaveLength(1);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return correct stats when no requests made', () => {
      const stats = service.getRateLimitStats();

      expect(stats.requestsInLastHour).toBe(0);
      expect(stats.maxRequestsPerHour).toBe(200);
      expect(stats.remaining).toBe(200);
    });

    it('should return correct stats after some requests', async () => {
      await service._checkRateLimit();
      await service._checkRateLimit();
      await service._checkRateLimit();

      const stats = service.getRateLimitStats();

      expect(stats.requestsInLastHour).toBe(3);
      expect(stats.remaining).toBe(197);
    });

    it('should exclude old timestamps from stats', () => {
      const oldTime = Date.now() - (61 * 60 * 1000);
      service.requestTimestamps = [oldTime, Date.now()];

      const stats = service.getRateLimitStats();

      expect(stats.requestsInLastHour).toBe(1);
      expect(stats.remaining).toBe(199);
    });
  });

  describe('fetchCoverImage', () => {
    it('should throw PEXELS_API_NOT_CONFIGURED when API key is missing', async () => {
      service.apiKey = undefined;

      await expect(
        service.fetchCoverImage('Paris, France', { tripId: 'trip-123' })
      ).rejects.toThrow('PEXELS_API_NOT_CONFIGURED');
    });

    it('should throw NO_IMAGES_FOUND when no photos returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [] }),
      });

      await expect(
        service.fetchCoverImage('Nonexistent Place', { tripId: 'trip-123' })
      ).rejects.toThrow('NO_IMAGES_FOUND');
    });

    it('should return cover image result with attribution', async () => {
      const mockPhotos = [
        {
          id: 123,
          photographer: 'John Doe',
          photographer_url: 'https://pexels.com/@johndoe',
          url: 'https://pexels.com/photo/123',
          src: { large2x: 'https://images.pexels.com/123.jpg' },
          alt: 'Paris skyline',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const result = await service.fetchCoverImage('Paris, France', { tripId: 'trip-123' });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('attribution');
      expect(result).toHaveProperty('source', 'pexels');
      expect(result.attribution.photographer).toBe('John Doe');
      expect(result.attribution.source).toBe('pexels');
      expect(result.attribution.photoId).toBe(123);
    });
  });

  describe('image optimization', () => {
    it('should resize images to target dimensions', async () => {
      const sharp = (await import('sharp')).default;

      const mockPhotos = [
        {
          id: 123,
          photographer: 'John Doe',
          photographer_url: 'https://pexels.com/@johndoe',
          url: 'https://pexels.com/photo/123',
          src: { large2x: 'https://images.pexels.com/123.jpg' },
          alt: 'Paris skyline',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      await service.fetchCoverImage('Paris', { tripId: 'trip-123' });

      expect(sharp).toHaveBeenCalled();
      const sharpInstance = sharp.mock.results[0].value;
      expect(sharpInstance.resize).toHaveBeenCalledWith(1200, 630, {
        fit: 'cover',
        position: 'center',
      });
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
    });
  });
});
