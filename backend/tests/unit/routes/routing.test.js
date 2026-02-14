import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

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

describe('Routing Routes', () => {
  let app;
  let mockGetRoute;
  let mockGetCacheStats;

  beforeEach(async () => {
    vi.resetModules();

    mockGetRoute = vi.fn();
    mockGetCacheStats = vi.fn();

    vi.doMock('../../../src/services/routing-service.js', () => ({
      getRoutingService: () => ({
        getRoute: mockGetRoute,
        getCacheStats: mockGetCacheStats,
      }),
      getValidTransportModes: () => ['walk', 'bike', 'drive', 'fly', 'boat'],
    }));

    vi.doMock('../../../src/middleware/rate-limit.js', () => ({
      routeRateLimits: {
        geocoding: {},
      },
    }));

    vi.doMock('../../../src/middleware/cache.js', () => ({
      generateETag: vi.fn(() => '"mock-etag"'),
      checkNotModified: vi.fn(() => false),
    }));

    const routingRouter = (await import('../../../src/routes/routing.js')).default;

    app = Fastify();
    app.decorateReply('setSharedCache', function () { return this; });
    await app.register(routingRouter);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /', () => {
    const validQuery = 'fromLat=48.8566&fromLng=2.3522&toLat=48.8738&toLng=2.2950&mode=walk';

    it('should return route data for valid request', async () => {
      mockGetRoute.mockResolvedValue({
        distance: 2.5,
        duration: 30,
        geometry: [[2.3522, 48.8566], [2.2950, 48.8738]],
        provider: 'osrm',
        cached: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.distance).toBe(2.5);
      expect(body.provider).toBe('osrm');
    });

    it('should return cached route data', async () => {
      mockGetRoute.mockResolvedValue({
        distance: 2.5,
        duration: 30,
        geometry: [],
        provider: 'osrm',
        cached: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.cached).toBe(true);
    });

    it('should return 400 for missing required params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/?fromLat=48.8566',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid coordinates', async () => {
      mockGetRoute.mockRejectedValue(new Error('Invalid coordinates'));

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 429 for rate limit exceeded', async () => {
      mockGetRoute.mockRejectedValue(new Error('RATE_LIMIT_EXCEEDED'));

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(429);
    });

    it('should return 503 for service unavailable', async () => {
      mockGetRoute.mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(503);
    });

    it('should return 500 for unexpected errors', async () => {
      mockGetRoute.mockRejectedValue(new Error('Unexpected error'));

      const response = await app.inject({
        method: 'GET',
        url: `/?${validQuery}`,
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /health', () => {
    it('should return routing health status', async () => {
      mockGetCacheStats.mockReturnValue({ size: 10, maxSize: 1000 });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.modes).toContain('walk');
      expect(body.cache.size).toBe(10);
    });
  });
});
