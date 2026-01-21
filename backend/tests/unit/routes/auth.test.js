import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock pg module at the top
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

describe('Auth Routes', () => {
  let app;
  let userService;
  let siteConfigService;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/services/user-service.js', () => ({
      register: vi.fn(),
      authenticate: vi.fn(),
      refreshAccessToken: vi.fn(),
      logout: vi.fn(),
      logoutAllDevices: vi.fn(),
      getProfile: vi.fn(),
    }));

    vi.doMock('../../../src/services/site-config-service.js', () => ({
      default: {
        getRegistrationEnabled: vi.fn(),
      },
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
      validateParams: vi.fn(() => (req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
      NotFoundError: class NotFoundError extends Error {
        constructor(message) { super(message); this.statusCode = 404; }
      },
      ValidationError: class ValidationError extends Error {
        constructor(message) { super(message); this.statusCode = 400; }
      },
      AuthenticationError: class AuthenticationError extends Error {
        constructor(message) { super(message); this.statusCode = 401; }
      },
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
        done();
      }),
    }));

    // Dynamically import the router and mocked services after mocks are in place
    const authRoutes = (await import('../../../src/routes/auth.js')).default;
    userService = await import('../../../src/services/user-service.js');
    siteConfigService = (await import('../../../src/services/site-config-service.js')).default;

    app = Fastify();
    app.decorate('auth', vi.fn((req, reply, done) => {
      req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
      done();
    }));
    app.register(authRoutes);
  });

  describe('POST /auth/register', () => {
    it('should register a new user when registration is enabled', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'user',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      siteConfigService.getRegistrationEnabled.mockResolvedValue(true);
      userService.register.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          fullName: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual(mockResult);
      expect(userService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      });
    });

    it('should return 403 when registration is disabled', async () => {
      siteConfigService.getRegistrationEnabled.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(403);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('REGISTRATION_DISABLED');
      expect(userService.register).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'user',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      userService.authenticate.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual(mockResult);
      expect(userService.authenticate).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      userService.refreshAccessToken.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual(mockResult);
      expect(userService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully and revoke refresh token', async () => {
      userService.logout.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({ success: true });
      expect(userService.logout).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should handle logout errors gracefully', async () => {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      userService.logout.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should logout from all devices when authenticated', async () => {
      userService.logoutAllDevices.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout-all',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toEqual({ success: true });
      expect(userService.logoutAllDevices).toHaveBeenCalledWith('user-123');
    });

    it('should handle logout-all errors gracefully', async () => {
      const error = new Error('Database error');
      error.statusCode = 500;
      userService.logoutAllDevices.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout-all',
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Database error');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      userService.getProfile.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user).toEqual(mockUser);
      expect(userService.getProfile).toHaveBeenCalledWith('user-123');
    });

    it('should handle profile not found', async () => {
      const error = new Error('User not found');
      error.statusCode = 404;
      userService.getProfile.mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('User not found');
    });
  });
});
