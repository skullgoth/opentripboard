// T034: Error handler middleware - structured error responses

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error types
 */
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

// Alias for convenience
export const ForbiddenError = AuthorizationError;

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Global error handler for Fastify
 * @param {Error} error - Error object
 * @param {Object} request - Fastify request
 * @param {Object} reply - Fastify reply
 */
export function errorHandler(error, request, reply) {
  // Handle rate limit errors (from @fastify/rate-limit)
  // The plugin throws the errorResponseBuilder output as an error object
  if (error.statusCode === 429 ||
      error.code === 'RATE_LIMIT_EXCEEDED' ||
      error.error === 'RATE_LIMIT_EXCEEDED' ||
      (error.message && error.message.includes('Too many requests'))) {
    return reply.code(429).send({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: error.retryAfter || 60,
    });
  }

  // Log error for debugging
  if (error.statusCode >= 500 || !error.isOperational) {
    console.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      userId: request.user?.userId,
    });
  }

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    error: error.code || 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
  };

  // Add validation errors if present
  if (error instanceof ValidationError && error.errors) {
    errorResponse.errors = error.errors;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Send error response
  reply.code(statusCode).send(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped handler
 */
export function asyncHandler(fn) {
  return async function (request, reply) {
    try {
      return await fn(request, reply);
    } catch (error) {
      errorHandler(error, request, reply);
    }
  };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(request, reply) {
  reply.code(404).send({
    error: 'NOT_FOUND',
    message: `Route ${request.method} ${request.url} not found`,
  });
}
