/**
 * Unit tests for CSRF Middleware
 * Tests CSRF protection using double-submit cookie pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrfPlugin } from '../../../src/middleware/csrf.js';
import crypto from 'crypto';

vi.mock('crypto', () => {
  const mockRandomBytes = vi.fn();
  const mockTimingSafeEqual = vi.fn();

  return {
    default: {
      randomBytes: mockRandomBytes,
      timingSafeEqual: mockTimingSafeEqual,
    },
    randomBytes: mockRandomBytes,
    timingSafeEqual: mockTimingSafeEqual,
  };
});

describe('CSRF Middleware', () => {
  let mockFastify;
  let preHandlerHook;
  let csrfTokenRoute;

  beforeEach(() => {
    vi.clearAllMocks();
    preHandlerHook = null;
    csrfTokenRoute = null;

    mockFastify = {
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      hasDecorator: vi.fn().mockReturnValue(true),
      register: vi.fn(),
      get: vi.fn((path, handler) => {
        if (path === '/api/v1/csrf-token') {
          csrfTokenRoute = handler;
        }
      }),
      addHook: vi.fn((hookName, handler) => {
        if (hookName === 'preHandler') {
          preHandlerHook = handler;
        }
      }),
    };
  });

  describe('plugin registration', () => {
    it('should enable CSRF protection by default', async () => {
      await csrfPlugin(mockFastify, {});

      expect(mockFastify.log.info).toHaveBeenCalledWith('CSRF protection is enabled');
      expect(mockFastify.get).toHaveBeenCalledWith('/api/v1/csrf-token', expect.any(Function));
      expect(mockFastify.addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));
    });

    it('should disable CSRF protection when enabled option is false', async () => {
      await csrfPlugin(mockFastify, { enabled: false });

      expect(mockFastify.log.info).toHaveBeenCalledWith('CSRF protection is disabled');
      expect(mockFastify.get).not.toHaveBeenCalled();
      expect(mockFastify.addHook).not.toHaveBeenCalled();
    });

    it('should disable CSRF protection when CSRF_ENABLED env is false', async () => {
      const originalEnv = process.env.CSRF_ENABLED;
      process.env.CSRF_ENABLED = 'false';

      await csrfPlugin(mockFastify, {});

      expect(mockFastify.log.info).toHaveBeenCalledWith('CSRF protection is disabled');
      expect(mockFastify.get).not.toHaveBeenCalled();
      expect(mockFastify.addHook).not.toHaveBeenCalled();

      process.env.CSRF_ENABLED = originalEnv;
    });

    it('should register cookie plugin if not already registered', async () => {
      mockFastify.hasDecorator.mockReturnValue(false);

      await csrfPlugin(mockFastify, {});

      expect(mockFastify.hasDecorator).toHaveBeenCalledWith('cookies');
      expect(mockFastify.register).toHaveBeenCalled();
    });

    it('should not register cookie plugin if already registered', async () => {
      mockFastify.hasDecorator.mockReturnValue(true);

      await csrfPlugin(mockFastify, {});

      expect(mockFastify.hasDecorator).toHaveBeenCalledWith('cookies');
      expect(mockFastify.register).not.toHaveBeenCalled();
    });
  });

  describe('CSRF token endpoint', () => {
    beforeEach(async () => {
      await csrfPlugin(mockFastify, {});
    });

    it('should generate and return CSRF token', async () => {
      const mockToken = 'a'.repeat(64);
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockToken),
      });

      const mockRequest = {};
      const mockReply = {
        setCookie: vi.fn(),
      };

      const result = await csrfTokenRoute(mockRequest, mockReply);

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockReply.setCookie).toHaveBeenCalledWith('csrf_token', mockToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
      expect(result).toEqual({ csrfToken: mockToken });
    });

    it('should set secure cookie in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockToken = 'a'.repeat(64);
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockToken),
      });

      const mockRequest = {};
      const mockReply = {
        setCookie: vi.fn(),
      };

      await csrfTokenRoute(mockRequest, mockReply);

      expect(mockReply.setCookie).toHaveBeenCalledWith('csrf_token', mockToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24,
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should merge custom cookie options', async () => {
      mockFastify.get.mockClear();
      await csrfPlugin(mockFastify, {
        cookieOptions: {
          domain: 'example.com',
          maxAge: 3600,
        },
      });

      // Get the route handler that was registered
      const handler = mockFastify.get.mock.calls.find(
        call => call[0] === '/api/v1/csrf-token'
      )?.[1];

      const mockToken = 'a'.repeat(64);
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: vi.fn().mockReturnValue(mockToken),
      });

      const mockRequest = {};
      const mockReply = {
        setCookie: vi.fn(),
      };

      await handler(mockRequest, mockReply);

      expect(mockReply.setCookie).toHaveBeenCalledWith('csrf_token', mockToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'strict',
        path: '/',
        maxAge: 3600,
        domain: 'example.com',
      });
    });
  });

  describe('preHandler hook - method filtering', () => {
    beforeEach(async () => {
      await csrfPlugin(mockFastify, {});
    });

    it('should skip GET requests', async () => {
      const mockRequest = {
        method: 'GET',
        url: '/api/v1/trips',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip HEAD requests', async () => {
      const mockRequest = {
        method: 'HEAD',
        url: '/api/v1/trips',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip OPTIONS requests', async () => {
      const mockRequest = {
        method: 'OPTIONS',
        url: '/api/v1/trips',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should verify POST requests', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it('should verify PUT requests', async () => {
      const mockRequest = {
        method: 'PUT',
        url: '/api/v1/trips/123',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it('should verify PATCH requests', async () => {
      const mockRequest = {
        method: 'PATCH',
        url: '/api/v1/trips/123',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it('should verify DELETE requests', async () => {
      const mockRequest = {
        method: 'DELETE',
        url: '/api/v1/trips/123',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });
  });

  describe('preHandler hook - route exclusions', () => {
    beforeEach(async () => {
      await csrfPlugin(mockFastify, {});
    });

    it('should skip /api/v1/auth/login', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip /api/v1/auth/register', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/auth/register',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip /api/v1/auth/refresh', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip /api/v1/shared/ routes', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/shared/abc123',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip /health endpoint', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/health',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should skip WebSocket upgrade requests', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/websocket',
        headers: {
          upgrade: 'websocket',
        },
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });
  });

  describe('preHandler hook - token validation', () => {
    beforeEach(async () => {
      await csrfPlugin(mockFastify, {});
    });

    it('should return 403 if cookie token is missing', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {
          'x-csrf-token': 'token123',
        },
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockFastify.log.warn).toHaveBeenCalledWith({
        msg: 'CSRF token missing',
        url: '/api/v1/trips',
        method: 'POST',
        hasCookie: false,
        hasHeader: true,
      });
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      });
    });

    it('should return 403 if header token is missing', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {},
        cookies: {
          csrf_token: 'token123',
        },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockFastify.log.warn).toHaveBeenCalledWith({
        msg: 'CSRF token missing',
        url: '/api/v1/trips',
        method: 'POST',
        hasCookie: true,
        hasHeader: false,
      });
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      });
    });

    it('should return 403 if both tokens are missing', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {},
        cookies: {},
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      });
    });

    it('should return 403 if tokens do not match', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {
          'x-csrf-token': 'token123',
        },
        cookies: {
          csrf_token: 'token456',
        },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(crypto.timingSafeEqual).mockReturnValue(false);

      await preHandlerHook(mockRequest, mockReply);

      expect(mockFastify.log.warn).toHaveBeenCalledWith({
        msg: 'CSRF token mismatch',
        url: '/api/v1/trips',
        method: 'POST',
      });
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'CSRF token invalid',
        code: 'CSRF_TOKEN_INVALID',
      });
    });

    it('should allow request if tokens match', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {
          'x-csrf-token': 'token123',
        },
        cookies: {
          csrf_token: 'token123',
        },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(crypto.timingSafeEqual).mockReturnValue(true);

      await preHandlerHook(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should use constant-time comparison for security', async () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/trips',
        headers: {
          'x-csrf-token': 'token123',
        },
        cookies: {
          csrf_token: 'token123',
        },
      };
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(crypto.timingSafeEqual).mockReturnValue(true);

      await preHandlerHook(mockRequest, mockReply);

      expect(crypto.timingSafeEqual).toHaveBeenCalled();
      const [arg1, arg2] = vi.mocked(crypto.timingSafeEqual).mock.calls[0];
      expect(Buffer.isBuffer(arg1)).toBe(true);
      expect(Buffer.isBuffer(arg2)).toBe(true);
      expect(arg1.toString()).toBe('token123');
      expect(arg2.toString()).toBe('token123');
    });
  });
});
