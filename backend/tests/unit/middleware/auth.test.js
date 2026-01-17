/**
 * Unit tests for Auth Middleware
 * Tests JWT-based authentication and authorization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, optionalAuthenticate } from '../../../src/middleware/auth.js';
import * as jwt from '../../../src/utils/jwt.js';

vi.mock('../../../src/utils/jwt.js');
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}));

describe('Auth Middleware', () => {
  let mockRequest;
  let mockReply;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      headers: {},
    };
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid token', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'access',
      });

      await authenticate(mockRequest, mockReply);

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      mockRequest.headers.authorization = undefined;

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue(null);

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    });

    it('should return 401 if token is null', async () => {
      mockRequest.headers.authorization = 'Bearer ';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue(null);

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('invalid-token');
      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    });

    it('should return 401 if token is expired', async () => {
      mockRequest.headers.authorization = 'Bearer expired-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('expired-token');
      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Token has expired');
      });

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    });

    it('should return 401 if token type is not access', async () => {
      mockRequest.headers.authorization = 'Bearer refresh-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('refresh-token');
      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-123',
        type: 'refresh', // Wrong type
      });

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    });

    it('should handle malformed authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidHeader';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue(null);

      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuthenticate', () => {
    it('should authenticate if valid token provided', async () => {
      mockRequest.headers.authorization = 'Bearer valid-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'access',
      });

      await optionalAuthenticate(mockRequest, mockReply);

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should set user to null if no token provided', async () => {
      mockRequest.headers.authorization = undefined;

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue(null);

      await optionalAuthenticate(mockRequest, mockReply);

      expect(mockRequest.user).toBeNull();
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should set user to null if token is invalid (no error)', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('invalid-token');
      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuthenticate(mockRequest, mockReply);

      expect(mockRequest.user).toBeNull();
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should set user to null if token type is not access', async () => {
      mockRequest.headers.authorization = 'Bearer refresh-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('refresh-token');
      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-123',
        type: 'refresh',
      });

      await optionalAuthenticate(mockRequest, mockReply);

      expect(mockRequest.user).toBeNull();
    });

    it('should not fail on token verification errors', async () => {
      mockRequest.headers.authorization = 'Bearer bad-token';

      vi.mocked(jwt.extractTokenFromHeader).mockReturnValue('bad-token');
      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      // Should not throw
      await expect(optionalAuthenticate(mockRequest, mockReply)).resolves.not.toThrow();
      expect(mockRequest.user).toBeNull();
    });
  });
});
