/**
 * Unit tests for Routing Service
 * Tests Haversine distance, RoutingService class, transport modes, and singleton
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  haversineDistance,
  RoutingService,
  getRoutingService,
  getTransportSpeeds,
  getValidTransportModes,
} from '../../../src/services/routing-service.js';

describe('Routing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('haversineDistance', () => {
    it('should calculate distance between Paris and Lyon (~392 km)', () => {
      const distance = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);

      expect(distance).toBeGreaterThan(380);
      expect(distance).toBeLessThan(410);
    });

    it('should return 0 for same coordinates', () => {
      const distance = haversineDistance(48.8566, 2.3522, 48.8566, 2.3522);

      expect(distance).toBe(0);
    });

    it('should calculate distance between antipodal points (~20000 km)', () => {
      // North pole to south pole
      const distance = haversineDistance(90, 0, -90, 0);

      expect(distance).toBeGreaterThan(19900);
      expect(distance).toBeLessThan(20100);
    });

    it('should be symmetric (A->B == B->A)', () => {
      const d1 = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);
      const d2 = haversineDistance(45.7640, 4.8357, 48.8566, 2.3522);

      expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });

    it('should handle crossing the prime meridian', () => {
      const distance = haversineDistance(51.5074, -0.1278, 51.5074, 0.1278);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(20);
    });

    it('should handle crossing the date line', () => {
      const distance = haversineDistance(0, 179, 0, -179);

      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(250);
    });
  });

  describe('RoutingService', () => {
    let service;

    beforeEach(() => {
      service = new RoutingService();
    });

    describe('getRoute', () => {
      it('should throw for invalid coordinates', async () => {
        await expect(service.getRoute(200, 0, 0, 0, 'drive')).rejects.toThrow(
          'Invalid coordinates provided'
        );
      });

      it('should throw for invalid transport mode', async () => {
        await expect(service.getRoute(48.8, 2.3, 45.7, 4.8, 'teleport')).rejects.toThrow(
          'Invalid transport mode: teleport'
        );
      });

      it('should use Haversine for fly mode', async () => {
        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');

        expect(result.provider).toBe('haversine');
        expect(result.distance).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.cached).toBe(false);
      });

      it('should use Haversine for boat mode', async () => {
        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'boat');

        expect(result.provider).toBe('haversine');
      });

      it('should cache results and return cached on second call', async () => {
        // First call for fly mode (no OSRM needed)
        const result1 = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');
        expect(result1.cached).toBe(false);

        const result2 = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');
        expect(result2.cached).toBe(true);
        expect(result2.distance).toBe(result1.distance);
      });

      it('should attempt OSRM for drive mode and fallback on error', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'drive');

        // Should fallback to Haversine
        expect(result.provider).toBe('haversine');
        expect(result.distance).toBeGreaterThan(0);
      });

      it('should attempt OSRM for walk mode', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            code: 'Ok',
            routes: [
              {
                distance: 500000, // 500km in meters
                duration: 36000,  // 10 hours in seconds
                geometry: {
                  coordinates: [[2.35, 48.85], [4.83, 45.76]],
                },
              },
            ],
          }),
        });

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'walk');

        expect(result.provider).toBe('osrm');
        expect(result.distance).toBe(500); // 500000m / 1000
        expect(result.duration).toBe(600); // 36000s / 60
      });

      it('should fallback when OSRM returns non-Ok code', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ code: 'NoRoute', routes: [] }),
        });

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'drive');

        expect(result.provider).toBe('haversine');
      });

      it('should fallback on OSRM 429 rate limit', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 429 });

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'drive');

        expect(result.provider).toBe('haversine');
      });

      it('should fallback on OSRM 503 service unavailable', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 503 });

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'drive');

        expect(result.provider).toBe('haversine');
      });

      it('should fallback on OSRM non-standard error codes', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500 });

        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'drive');

        expect(result.provider).toBe('haversine');
      });

      it('should return geometry as GeoJSON coordinates for Haversine', async () => {
        const result = await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');

        expect(result.geometry).toEqual([
          [2.3522, 48.8566],
          [4.8357, 45.7640],
        ]);
      });

      it('should validate latitude boundaries', async () => {
        await expect(service.getRoute(-91, 0, 0, 0, 'fly')).rejects.toThrow(
          'Invalid coordinates'
        );
        await expect(service.getRoute(91, 0, 0, 0, 'fly')).rejects.toThrow(
          'Invalid coordinates'
        );
      });

      it('should validate longitude boundaries', async () => {
        await expect(service.getRoute(0, -181, 0, 0, 'fly')).rejects.toThrow(
          'Invalid coordinates'
        );
        await expect(service.getRoute(0, 181, 0, 0, 'fly')).rejects.toThrow(
          'Invalid coordinates'
        );
      });

      it('should reject non-number coordinates', async () => {
        await expect(service.getRoute('48', 2, 45, 4, 'fly')).rejects.toThrow(
          'Invalid coordinates'
        );
      });
    });

    describe('getCacheStats', () => {
      it('should return cache size info', () => {
        const stats = service.getCacheStats();

        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('maxSize');
        expect(stats.size).toBe(0);
        expect(stats.maxSize).toBe(500);
      });

      it('should reflect cached entries', async () => {
        await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');

        const stats = service.getCacheStats();
        expect(stats.size).toBe(1);
      });
    });

    describe('clearCache', () => {
      it('should empty the cache', async () => {
        await service.getRoute(48.8566, 2.3522, 45.7640, 4.8357, 'fly');
        expect(service.getCacheStats().size).toBe(1);

        service.clearCache();
        expect(service.getCacheStats().size).toBe(0);
      });
    });
  });

  describe('getRoutingService', () => {
    it('should return a RoutingService instance', () => {
      const instance = getRoutingService();

      expect(instance).toBeInstanceOf(RoutingService);
    });

    it('should return the same singleton instance', () => {
      const instance1 = getRoutingService();
      const instance2 = getRoutingService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getTransportSpeeds', () => {
    it('should return all transport mode speeds', () => {
      const speeds = getTransportSpeeds();

      expect(speeds).toHaveProperty('walk');
      expect(speeds).toHaveProperty('bike');
      expect(speeds).toHaveProperty('drive');
      expect(speeds).toHaveProperty('train');
      expect(speeds).toHaveProperty('fly');
      expect(speeds).toHaveProperty('boat');
    });

    it('should return a copy (not the original object)', () => {
      const speeds1 = getTransportSpeeds();
      speeds1.walk = 999;

      const speeds2 = getTransportSpeeds();
      expect(speeds2.walk).not.toBe(999);
    });

    it('should have positive speed values', () => {
      const speeds = getTransportSpeeds();

      Object.values(speeds).forEach((speed) => {
        expect(speed).toBeGreaterThan(0);
      });
    });
  });

  describe('getValidTransportModes', () => {
    it('should return all valid transport modes', () => {
      const modes = getValidTransportModes();

      expect(modes).toContain('walk');
      expect(modes).toContain('bike');
      expect(modes).toContain('drive');
      expect(modes).toContain('train');
      expect(modes).toContain('fly');
      expect(modes).toContain('boat');
    });

    it('should return an array', () => {
      const modes = getValidTransportModes();

      expect(Array.isArray(modes)).toBe(true);
    });
  });
});
