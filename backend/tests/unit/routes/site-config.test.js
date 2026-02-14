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

describe('Site Config Routes', () => {
  let app;
  let siteConfigService;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../src/services/site-config-service.js', () => ({
      default: {
        getPublicSettings: vi.fn(),
        getRegistrationEnabled: vi.fn(),
        updateRegistrationEnabled: vi.fn(),
      },
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      requireAdmin: vi.fn((req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
    }));

    const siteConfigRouter = (await import('../../../src/routes/site-config.js')).default;
    siteConfigService = (await import('../../../src/services/site-config-service.js')).default;

    app = Fastify();
    // Decorate with auth for admin routes
    app.decorate('auth', (req, reply, done) => {
      req.user = { userId: 'admin-123', role: 'admin' };
      done();
    });
    app.register(siteConfigRouter);
  });

  describe('GET /site-config/public', () => {
    it('should return public settings', async () => {
      siteConfigService.getPublicSettings.mockResolvedValue({
        registrationEnabled: true,
        siteName: 'OpenTripBoard',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/site-config/public',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.registrationEnabled).toBe(true);
    });
  });

  describe('GET /admin/site-config', () => {
    it('should return admin site config', async () => {
      siteConfigService.getRegistrationEnabled.mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/admin/site-config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.registrationEnabled).toBe(true);
    });
  });

  describe('PATCH /admin/site-config', () => {
    it('should update site config', async () => {
      siteConfigService.updateRegistrationEnabled.mockResolvedValue(undefined);
      siteConfigService.getRegistrationEnabled.mockResolvedValue(false);

      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/site-config',
        payload: { registrationEnabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.registrationEnabled).toBe(false);
      expect(body.message).toBe('Site configuration updated');
    });
  });
});
