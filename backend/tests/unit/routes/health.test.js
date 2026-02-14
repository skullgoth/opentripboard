import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Health Routes', () => {
  let app;
  let mockQuery;

  beforeEach(async () => {
    vi.resetModules();

    mockQuery = vi.fn();

    vi.doMock('../../../src/db/connection.js', () => ({
      query: mockQuery,
    }));

    const healthRouter = (await import('../../../src/routes/health.js')).default;

    app = Fastify();
    app.register(healthRouter);
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health with DB ok', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ time: '2024-01-01T00:00:00Z' }],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
      expect(body.checks.database).toBe('ok');
    });

    it('should return degraded health when DB fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('degraded');
      expect(body.checks.database).toBe('error');
      expect(body.checks.databaseError).toBe('Connection refused');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when DB responds', async () => {
      mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.ready).toBe(true);
    });

    it('should return 503 when DB fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.ready).toBe(false);
    });
  });

  describe('GET /health/live', () => {
    it('should return alive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.alive).toBe(true);
    });
  });
});
