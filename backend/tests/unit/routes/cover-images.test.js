// T034: Integration tests for cover image endpoint
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

describe('Cover Images Routes', () => {
  let app;
  let coverImageService;
  let mockFetchCoverImage;
  let mockGetRateLimitStats;

  beforeEach(async () => {
    vi.resetModules();

    // Create mock functions
    mockFetchCoverImage = vi.fn();
    mockGetRateLimitStats = vi.fn();

    // Set environment variable
    process.env.PEXELS_API_KEY = 'test-api-key';

    // Mock cover image service
    vi.doMock('../../../src/services/cover-image-service.js', () => ({
      getCoverImageService: () => ({
        fetchCoverImage: mockFetchCoverImage,
        getRateLimitStats: mockGetRateLimitStats,
      }),
    }));

    // Mock rate limiting
    vi.doMock('../../../src/middleware/rate-limit.js', () => ({
      routeRateLimits: {
        coverImages: {},
      },
    }));

    // Import the router after mocks
    const coverImagesRouter = (await import('../../../src/routes/cover-images.js?t=' + Date.now())).default;

    app = Fastify();
    await app.register(coverImagesRouter);
    await app.ready();

    // Set up service reference
    coverImageService = {
      fetchCoverImage: mockFetchCoverImage,
      getRateLimitStats: mockGetRateLimitStats,
    };
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
    delete process.env.PEXELS_API_KEY;
  });

  describe('POST /fetch', () => {
    const validRequest = {
      destination: 'Paris, France',
      tripId: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('should return cover image result for valid request', async () => {
      const mockResult = {
        url: '/uploads/covers/trip-123-1234567890.jpg',
        attribution: {
          source: 'pexels',
          photographer: 'John Doe',
          photographerUrl: 'https://pexels.com/@johndoe',
          photoUrl: 'https://pexels.com/photo/123',
          photoId: 123,
        },
        source: 'pexels',
      };

      coverImageService.fetchCoverImage.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.url).toBe(mockResult.url);
      expect(body.attribution.photographer).toBe('John Doe');
      expect(body.source).toBe('pexels');
    });

    it('should return 400 for missing destination', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: { tripId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing tripId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: { destination: 'Paris, France' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid tripId format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: { destination: 'Paris, France', tripId: 'not-a-uuid' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty destination', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: { destination: '', tripId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 503 when Pexels API not configured', async () => {
      coverImageService.fetchCoverImage.mockRejectedValue(
        new Error('PEXELS_API_NOT_CONFIGURED')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Service Unavailable');
      expect(body.message).toContain('not configured');
    });

    it('should return 429 when rate limit exceeded', async () => {
      coverImageService.fetchCoverImage.mockRejectedValue(
        new Error('RATE_LIMIT_EXCEEDED')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Too Many Requests');
    });

    it('should return 404 when no images found', async () => {
      coverImageService.fetchCoverImage.mockRejectedValue(
        new Error('NO_IMAGES_FOUND')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('Paris, France');
    });

    it('should return 503 when request times out', async () => {
      coverImageService.fetchCoverImage.mockRejectedValue(
        new Error('REQUEST_TIMEOUT')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Service Unavailable');
      expect(body.message).toContain('timed out');
    });

    it('should return 500 for unexpected errors', async () => {
      coverImageService.fetchCoverImage.mockRejectedValue(
        new Error('Unexpected database error')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/fetch',
        payload: validRequest,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('GET /health', () => {
    it('should return health status with rate limit stats', async () => {
      const mockStats = {
        requestsInLastHour: 42,
        maxRequestsPerHour: 200,
        remaining: 158,
      };

      coverImageService.getRateLimitStats.mockReturnValue(mockStats);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.configured).toBe(true);
      expect(body.rateLimit).toEqual(mockStats);
    });

    it('should indicate when API is not configured', async () => {
      delete process.env.PEXELS_API_KEY;

      coverImageService.getRateLimitStats.mockReturnValue({
        requestsInLastHour: 0,
        maxRequestsPerHour: 200,
        remaining: 200,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.configured).toBe(false);
    });
  });
});
