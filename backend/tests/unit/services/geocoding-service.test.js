// T021: Unit tests for geocoding service
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock lru-cache before importing the service
vi.mock('lru-cache', () => {
  class MockLRUCache {
    constructor(options) {
      this.max = options.max || 100;
      this._store = new Map();
    }
    get(key) {
      return this._store.get(key);
    }
    set(key, value) {
      this._store.set(key, value);
    }
    get size() {
      return this._store.size;
    }
    clear() {
      this._store.clear();
    }
  }
  return { LRUCache: MockLRUCache };
});

import { GeocodingService } from '../../../src/services/geocoding-service.js';

describe('GeocodingService', () => {
  let service;
  let mockNominatimClient;

  beforeEach(() => {
    // Mock the Nominatim client
    mockNominatimClient = {
      search: vi.fn(),
    };

    service = new GeocodingService();
    service.client = mockNominatimClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search for destinations and return results', async () => {
      const mockResults = [
        {
          place_id: 123456,
          display_name: 'Paris, Île-de-France, France',
          lat: '48.8566',
          lon: '2.3522',
          type: 'city',
          address: {
            city: 'Paris',
            state: 'Île-de-France',
            country: 'France',
          },
        },
      ];

      mockNominatimClient.search.mockResolvedValue(mockResults);

      const result = await service.search('Paris');

      expect(result.cached).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        place_id: 123456,
        display_name: 'Paris, Île-de-France, France',
        lat: 48.8566,
        lon: 2.3522,
        type: 'city',
        validated: true,
      });
    });

    it('should cache search results', async () => {
      const mockResults = [
        {
          place_id: 123,
          display_name: 'Tokyo, Japan',
          lat: '35.6762',
          lon: '139.6503',
          type: 'city',
          address: {},
        },
      ];

      mockNominatimClient.search.mockResolvedValue(mockResults);

      // First call - should hit API
      const result1 = await service.search('Tokyo');
      expect(result1.cached).toBe(false);
      expect(mockNominatimClient.search).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await service.search('Tokyo');
      expect(result2.cached).toBe(true);
      expect(mockNominatimClient.search).toHaveBeenCalledTimes(1); // Not called again
      expect(result2.results).toEqual(result1.results);
    });

    it('should respect rate limiting', async () => {
      const mockResults = [];
      mockNominatimClient.search.mockResolvedValue(mockResults);

      const start = Date.now();
      await service.search('Paris');
      await service.search('London');
      const duration = Date.now() - start;

      // Should take at least 1 second due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(1000);
    });

    it('should throw error for queries less than 2 characters', async () => {
      await expect(service.search('P')).rejects.toThrow(
        'Query must be at least 2 characters'
      );
    });

    it('should throw error for empty query', async () => {
      await expect(service.search('')).rejects.toThrow(
        'Query must be a non-empty string'
      );
    });

    it('should throw error for non-string query', async () => {
      await expect(service.search(123)).rejects.toThrow(
        'Query must be a non-empty string'
      );
    });

    it('should handle rate limit exceeded error', async () => {
      mockNominatimClient.search.mockRejectedValue(
        new Error('RATE_LIMIT_EXCEEDED')
      );

      await expect(service.search('Paris')).rejects.toThrow(
        'Geocoding service rate limit exceeded'
      );
    });

    it('should handle service unavailable error', async () => {
      mockNominatimClient.search.mockRejectedValue(
        new Error('SERVICE_UNAVAILABLE')
      );

      await expect(service.search('Paris')).rejects.toThrow(
        'Geocoding service temporarily unavailable'
      );
    });

    it('should handle request timeout error', async () => {
      mockNominatimClient.search.mockRejectedValue(new Error('REQUEST_TIMEOUT'));

      await expect(service.search('Paris')).rejects.toThrow(
        'Geocoding request timed out'
      );
    });

    it('should normalize cache keys (case insensitive)', async () => {
      const mockResults = [
        {
          place_id: 123,
          display_name: 'Paris',
          lat: '48.8566',
          lon: '2.3522',
          type: 'city',
          address: {},
        },
      ];

      mockNominatimClient.search.mockResolvedValue(mockResults);

      // Search with lowercase
      await service.search('paris');
      expect(mockNominatimClient.search).toHaveBeenCalledTimes(1);

      // Search with uppercase - should use cache
      const result = await service.search('PARIS');
      expect(result.cached).toBe(true);
      expect(mockNominatimClient.search).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should respect limit parameter', async () => {
      mockNominatimClient.search.mockResolvedValue([]);

      await service.search('Paris', { limit: 10 });

      expect(mockNominatimClient.search).toHaveBeenCalledWith('Paris', 10, 'en');
    });

    it('should respect language parameter', async () => {
      mockNominatimClient.search.mockResolvedValue([]);

      await service.search('Paris', { language: 'fr' });

      expect(mockNominatimClient.search).toHaveBeenCalledWith('Paris', 5, 'fr');
    });
  });

  describe('validateDestinationData', () => {
    it('should validate correct destination data', () => {
      const validData = {
        place_id: 123456,
        display_name: 'Paris, France',
        lat: 48.8566,
        lon: 2.3522,
        validated: true,
      };

      expect(service.validateDestinationData(validData)).toBe(true);
    });

    it('should return false for missing required fields', () => {
      const invalidData = {
        place_id: 123456,
        display_name: 'Paris, France',
        // Missing lat, lon, validated
      };

      expect(service.validateDestinationData(invalidData)).toBe(false);
    });

    it('should return false for invalid types', () => {
      const invalidData = {
        place_id: '123456', // Should be number
        display_name: 'Paris, France',
        lat: 48.8566,
        lon: 2.3522,
        validated: true,
      };

      expect(service.validateDestinationData(invalidData)).toBe(false);
    });

    it('should return false for invalid latitude', () => {
      const invalidData = {
        place_id: 123456,
        display_name: 'Paris, France',
        lat: 91, // Out of range
        lon: 2.3522,
        validated: true,
      };

      expect(service.validateDestinationData(invalidData)).toBe(false);
    });

    it('should return false for invalid longitude', () => {
      const invalidData = {
        place_id: 123456,
        display_name: 'Paris, France',
        lat: 48.8566,
        lon: 181, // Out of range
        validated: true,
      };

      expect(service.validateDestinationData(invalidData)).toBe(false);
    });

    it('should return false for null input', () => {
      // Note: null handling is done at the service layer (trip-service.js)
      // The validateDestinationData method itself returns false for null
      expect(service.validateDestinationData(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(service.validateDestinationData('invalid')).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const mockResults = [
        {
          place_id: 123,
          display_name: 'Paris',
          lat: '48.8566',
          lon: '2.3522',
          type: 'city',
          address: {},
        },
      ];

      mockNominatimClient.search.mockResolvedValue(mockResults);

      // Populate cache
      await service.search('Paris');
      expect(service.cache.size).toBeGreaterThan(0);

      // Clear cache
      service.clearCache();
      expect(service.cache.size).toBe(0);
    });
  });
});
