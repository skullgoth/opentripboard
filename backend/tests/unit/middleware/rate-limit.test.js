import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('../../../src/utils/jwt.js', () => ({
  extractTokenFromHeader: vi.fn(),
  decodeToken: vi.fn(),
}));

describe('Rate Limit Middleware', () => {
  let rateLimitConfig, routeRateLimits, registerRateLimit;
  let extractTokenFromHeader, decodeToken;

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.RATE_LIMIT_DISABLED;
    delete process.env.DEBUG_RATE_LIMIT;

    const jwtMod = await import('../../../src/utils/jwt.js');
    extractTokenFromHeader = jwtMod.extractTokenFromHeader;
    decodeToken = jwtMod.decodeToken;

    const mod = await import('../../../src/middleware/rate-limit.js');
    rateLimitConfig = mod.rateLimitConfig;
    routeRateLimits = mod.routeRateLimits;
    registerRateLimit = mod.registerRateLimit;
  });

  describe('rateLimitConfig', () => {
    it('should have global config with 100 requests per minute', () => {
      expect(rateLimitConfig.global.max).toBe(100);
      expect(rateLimitConfig.global.timeWindow).toBe('1 minute');
    });

    it('should have auth config with 10 requests per minute', () => {
      expect(rateLimitConfig.auth.max).toBe(10);
      expect(rateLimitConfig.auth.timeWindow).toBe('1 minute');
    });

    it('should have password config with 5 requests per 15 minutes', () => {
      expect(rateLimitConfig.password.max).toBe(5);
      expect(rateLimitConfig.password.timeWindow).toBe('15 minutes');
    });

    it('should have read config with 200 requests per minute', () => {
      expect(rateLimitConfig.read.max).toBe(200);
      expect(rateLimitConfig.read.timeWindow).toBe('1 minute');
    });

    it('should have write config with 50 requests per minute', () => {
      expect(rateLimitConfig.write.max).toBe(50);
      expect(rateLimitConfig.write.timeWindow).toBe('1 minute');
    });

    it('should have upload config with 10 per minute', () => {
      expect(rateLimitConfig.upload.max).toBe(10);
      expect(rateLimitConfig.upload.timeWindow).toBe('1 minute');
    });

    it('should have geocoding config with 60 per minute', () => {
      expect(rateLimitConfig.geocoding.max).toBe(60);
      expect(rateLimitConfig.geocoding.timeWindow).toBe('1 minute');
    });

    it('should have coverImage config with 200 per hour', () => {
      expect(rateLimitConfig.coverImage.max).toBe(200);
      expect(rateLimitConfig.coverImage.timeWindow).toBe('1 hour');
    });
  });

  describe('rateLimitConfig.auth.keyGenerator', () => {
    it('should use x-forwarded-for header when available', () => {
      const request = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, ip: '172.17.0.1' };
      const key = rateLimitConfig.auth.keyGenerator(request);
      expect(key).toBe('auth:1.2.3.4');
    });

    it('should use x-real-ip header as fallback', () => {
      const request = { headers: { 'x-real-ip': '10.0.0.1' }, ip: '172.17.0.1' };
      const key = rateLimitConfig.auth.keyGenerator(request);
      expect(key).toBe('auth:10.0.0.1');
    });

    it('should use request.ip as last resort', () => {
      const request = { headers: {}, ip: '192.168.1.1' };
      const key = rateLimitConfig.auth.keyGenerator(request);
      expect(key).toBe('auth:192.168.1.1');
    });

    it('should use unknown when no IP available', () => {
      const request = { headers: {} };
      const key = rateLimitConfig.auth.keyGenerator(request);
      expect(key).toBe('auth:unknown');
    });
  });

  describe('rateLimitConfig.password.keyGenerator', () => {
    it('should use x-forwarded-for header', () => {
      const request = { headers: { 'x-forwarded-for': '1.2.3.4' }, ip: '172.17.0.1' };
      const key = rateLimitConfig.password.keyGenerator(request);
      expect(key).toBe('pwd:1.2.3.4');
    });

    it('should use x-real-ip as fallback', () => {
      const request = { headers: { 'x-real-ip': '10.0.0.1' }, ip: '172.17.0.1' };
      const key = rateLimitConfig.password.keyGenerator(request);
      expect(key).toBe('pwd:10.0.0.1');
    });
  });

  describe('routeRateLimits', () => {
    it('should have auth route limits', () => {
      expect(routeRateLimits.auth.rateLimit.max).toBe(10);
      expect(routeRateLimits.auth.rateLimit.timeWindow).toBe('1 minute');
      expect(routeRateLimits.auth.rateLimit.keyGenerator).toBeDefined();
    });

    it('should have password route limits', () => {
      expect(routeRateLimits.password.rateLimit.max).toBe(5);
      expect(routeRateLimits.password.rateLimit.timeWindow).toBe('15 minutes');
    });

    it('should have upload route limits', () => {
      expect(routeRateLimits.upload.rateLimit.max).toBe(10);
    });

    it('should have geocoding route limits', () => {
      expect(routeRateLimits.geocoding.rateLimit.max).toBe(60);
    });

    it('should have coverImages route limits', () => {
      expect(routeRateLimits.coverImages.rateLimit.max).toBe(200);
    });
  });

  describe('registerRateLimit', () => {
    it('should skip registration when RATE_LIMIT_DISABLED is true', async () => {
      vi.resetModules();
      process.env.RATE_LIMIT_DISABLED = 'true';

      const mod = await import('../../../src/middleware/rate-limit.js');
      const fastify = {
        register: vi.fn(),
        log: { info: vi.fn() },
      };

      await mod.registerRateLimit(fastify);
      expect(fastify.register).not.toHaveBeenCalled();
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('disabled')
      );
    });

    it('should register rate limit plugin when enabled', async () => {
      const fastify = {
        register: vi.fn(),
        log: { info: vi.fn() },
      };

      await registerRateLimit(fastify);
      expect(fastify.register).toHaveBeenCalled();
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('enabled')
      );
    });
  });
});
