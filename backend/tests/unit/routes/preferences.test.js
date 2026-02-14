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

describe('Preferences Routes', () => {
  let app;
  let preferenceService;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../src/services/preference-service.js', () => ({
      default: {
        getPreferences: vi.fn(),
        updatePreferences: vi.fn(),
        getSupportedLanguages: vi.fn(),
        getDefaults: vi.fn(),
      },
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    // Mock cache middleware - preferences route uses reply.setCacheHeaders
    vi.doMock('../../../src/middleware/cache.js', () => ({
      generateETag: vi.fn(() => '"mock-etag"'),
      checkNotModified: vi.fn(() => false),
      default: async (fastify) => {
        fastify.decorateReply('setCacheHeaders', function () { return this; });
        fastify.decorateReply('setNoCache', function () { return this; });
        fastify.decorateReply('setPrivateCache', function () { return this; });
        fastify.decorateReply('setApiCache', function () { return this; });
        fastify.decorateReply('setSharedCache', function () { return this; });
      },
    }));

    const preferencesRouter = (await import('../../../src/routes/preferences.js')).default;
    preferenceService = (await import('../../../src/services/preference-service.js')).default;

    app = Fastify();
    app.decorateReply('setCacheHeaders', function () { return this; });
    app.register(preferencesRouter);
  });

  describe('GET /preferences', () => {
    it('should return user preferences', async () => {
      preferenceService.getPreferences.mockResolvedValue({
        language: 'en',
        dateFormat: 'mdy',
        timeFormat: '12h',
        distanceFormat: 'mi',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/preferences',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.language).toBe('en');
    });
  });

  describe('PUT /preferences', () => {
    it('should update preferences', async () => {
      preferenceService.updatePreferences.mockResolvedValue({
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/preferences',
        payload: { language: 'fr', dateFormat: 'dmy' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.language).toBe('fr');
      expect(body.message).toBe('Preferences saved successfully');
    });
  });

  describe('GET /preferences/languages', () => {
    it('should return supported languages', async () => {
      preferenceService.getSupportedLanguages.mockReturnValue([
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/preferences/languages',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('GET /preferences/defaults', () => {
    it('should return defaults for locale', async () => {
      preferenceService.getDefaults.mockReturnValue({
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/preferences/defaults?locale=fr',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.language).toBe('fr');
    });

    it('should return defaults without locale', async () => {
      preferenceService.getDefaults.mockReturnValue({
        language: 'en',
        dateFormat: 'mdy',
        timeFormat: '12h',
        distanceFormat: 'mi',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/preferences/defaults',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });
});
