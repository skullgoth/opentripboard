/**
 * Unit tests for Error Handler Middleware
 * Tests error classes and error handling functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
} from '../../../src/middleware/error-handler.js';

describe('Error Handler Middleware', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create error with custom status code and code', () => {
      const error = new AppError('Custom error', 418, 'TEAPOT_ERROR');

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(418);
      expect(error.code).toBe('TEAPOT_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should have stack trace', () => {
      const error = new AppError('Stack test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack test');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with default values', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual([]);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create validation error with errors array', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', errors);

      expect(error.errors).toEqual(errors);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Token expired');

      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Admin access required');

      expect(error.message).toBe('Admin access required');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create not found error with custom resource name', () => {
      const error = new NotFoundError('Trip');

      expect(error.message).toBe('Trip not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create conflict error with custom message', () => {
      const error = new ConflictError('Email already registered');

      expect(error.message).toBe('Email already registered');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('errorHandler', () => {
    let mockRequest;
    let mockReply;
    let originalEnv;
    let consoleErrorSpy;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRequest = {
        url: '/api/test',
        method: 'GET',
        user: { userId: 'user-123' },
      };

      mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      consoleErrorSpy.mockRestore();
    });

    it('should handle AppError with correct status code', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TEST_ERROR',
          message: 'Test error',
        })
      );
    });

    it('should handle ValidationError with errors array', () => {
      const errors = [{ field: 'email', message: 'Invalid' }];
      const error = new ValidationError('Validation failed', errors);

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: errors,
        })
      );
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        })
      );
    });

    it('should log 500+ errors to console', () => {
      const error = new AppError('Server error', 500, 'SERVER_ERROR');

      errorHandler(error, mockRequest, mockReply);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unhandled error:',
        expect.objectContaining({
          message: 'Server error',
          url: '/api/test',
          method: 'GET',
          userId: 'user-123',
        })
      );
    });

    it('should log non-operational errors to console', () => {
      const error = new Error('Unexpected error');
      // Non-operational error (isOperational is undefined)

      errorHandler(error, mockRequest, mockReply);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unhandled error:',
        expect.objectContaining({
          message: 'Unexpected error',
        })
      );
    });

    it('should not log 4xx operational errors', () => {
      const error = new NotFoundError('Trip');

      errorHandler(error, mockRequest, mockReply);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new AppError('Dev error', 400, 'DEV_ERROR');

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should not include stack trace in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new AppError('Prod error', 400, 'PROD_ERROR');

      errorHandler(error, mockRequest, mockReply);

      const sentResponse = mockReply.send.mock.calls[0][0];
      expect(sentResponse.stack).toBeUndefined();
    });

    it('should handle error without message', () => {
      const error = new Error();
      error.message = '';

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'An unexpected error occurred',
        })
      );
    });

    it('should handle request without user', () => {
      mockRequest.user = undefined;
      const error = new AppError('Error', 500, 'ERROR');

      errorHandler(error, mockRequest, mockReply);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unhandled error:',
        expect.objectContaining({
          userId: undefined,
        })
      );
    });
  });

  describe('asyncHandler', () => {
    let mockRequest;
    let mockReply;

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRequest = {
        url: '/api/test',
        method: 'GET',
      };

      mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
    });

    it('should call handler function successfully', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(handler);

      await wrapped(mockRequest, mockReply);

      expect(handler).toHaveBeenCalledWith(mockRequest, mockReply);
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should catch and handle errors from async handlers', async () => {
      const error = new AppError('Async error', 400, 'ASYNC_ERROR');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(handler);

      await wrapped(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ASYNC_ERROR',
          message: 'Async error',
        })
      );
    });

    it('should handle thrown errors from sync code', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const wrapped = asyncHandler(handler);

      await wrapped(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Sync error',
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    let mockRequest;
    let mockReply;

    beforeEach(() => {
      mockRequest = {
        url: '/api/unknown',
        method: 'POST',
      };

      mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
    });

    it('should return 404 with route information', () => {
      notFoundHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'NOT_FOUND',
        message: 'Route POST /api/unknown not found',
      });
    });

    it('should include correct method in message', () => {
      mockRequest.method = 'DELETE';
      mockRequest.url = '/api/trips/123';

      notFoundHandler(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'NOT_FOUND',
        message: 'Route DELETE /api/trips/123 not found',
      });
    });
  });
});
