// T022: Integration tests for geocoding endpoint
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Mock pg module
vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Geocoding Routes', () => {
  let app;
  let geocodingService;
  let mockSearchFn;
  let mockGetCacheStatsFn;

  beforeEach(async () => {
    vi.resetModules();

    // Create mock functions
    mockSearchFn = vi.fn();
    mockGetCacheStatsFn = vi.fn();

    // Mock geocoding service
    vi.doMock('../../../src/services/geocoding-service.js', () => ({
      getGeocodingService: () => ({
        search: mockSearchFn,
        getCacheStats: mockGetCacheStatsFn,
      }),
    }));

    // Mock rate limiting
    vi.doMock('../../../src/middleware/rate-limit.js', () => ({
      routeRateLimits: {
        geocoding: {},
      },
    }));

    // Import the router after mocks
    const geocodingRouter = (await import('../../../src/routes/geocoding.js?t=' + Date.now())).default;

    app = Fastify();
    await app.register(geocodingRouter);
    await app.ready();

    // Set up geocodingService reference
    geocodingService = {
      search: mockSearchFn,
      getCacheStats: mockGetCacheStatsFn,
    };
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /search', () => {
    it('should return search results for valid query', async () => {
      const mockResults = [
        {
          place_id: 123456,
          display_name: 'Paris, Île-de-France, France',
          lat: 48.8566,
          lon: 2.3522,
          type: 'city',
          address: {
            city: 'Paris',
            state: 'Île-de-France',
            country: 'France',
          },
          validated: true,
        },
      ];

      geocodingService.search.mockResolvedValue({
        results: mockResults,
        cached: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Paris&limit=5',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].display_name).toBe('Paris, Île-de-France, France');
      expect(body.cached).toBe(false);
    });

    it('should return cached results', async () => {
      const mockResults = [
        {
          place_id: 123,
          display_name: 'Tokyo, Japan',
          lat: 35.6762,
          lon: 139.6503,
          type: 'city',
          address: {},
          validated: true,
        },
      ];

      geocodingService.search.mockResolvedValue({
        results: mockResults,
        cached: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Tokyo',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.cached).toBe(true);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for query less than 2 characters', async () => {
      geocodingService.search.mockRejectedValue(
        new Error('Query must be at least 2 characters')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=P',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 429 for rate limit exceeded', async () => {
      geocodingService.search.mockRejectedValue(
        new Error('Geocoding service rate limit exceeded')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Paris',
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Too Many Requests');
    });

    it('should return 503 for service unavailable', async () => {
      geocodingService.search.mockRejectedValue(
        new Error('Geocoding service temporarily unavailable')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Paris',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Service Unavailable');
    });

    it('should return 503 for timeout', async () => {
      geocodingService.search.mockRejectedValue(
        new Error('Geocoding request timed out')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Paris',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Service Unavailable');
    });

    it('should handle empty results', async () => {
      geocodingService.search.mockResolvedValue({
        results: [],
        cached: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=NonexistentPlace12345',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      geocodingService.search.mockResolvedValue({
        results: [],
        cached: false,
      });

      await app.inject({
        method: 'GET',
        url: '/search?q=Paris&limit=10',
      });

      expect(geocodingService.search).toHaveBeenCalledWith('Paris', {
        limit: 10,
        language: 'en',
      });
    });

    it('should respect language parameter', async () => {
      geocodingService.search.mockResolvedValue({
        results: [],
        cached: false,
      });

      await app.inject({
        method: 'GET',
        url: '/search?q=Paris&language=fr',
      });

      expect(geocodingService.search).toHaveBeenCalledWith('Paris', {
        limit: 5,
        language: 'fr',
      });
    });

    it('should return 500 for unexpected errors', async () => {
      geocodingService.search.mockRejectedValue(new Error('Unexpected error'));

      const response = await app.inject({
        method: 'GET',
        url: '/search?q=Paris',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('GET /health', () => {
    it('should return health status with cache stats', async () => {
      const mockStats = {
        size: 42,
        maxSize: 1000,
        hitRate: 75.5,
      };

      geocodingService.getCacheStats.mockReturnValue(mockStats);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.cache).toEqual(mockStats);
    });
  });
});
