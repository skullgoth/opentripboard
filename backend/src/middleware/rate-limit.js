// T291: Rate limiting middleware for API protection
import rateLimit from '@fastify/rate-limit';

/**
 * Rate limiting configuration
 * Different limits for different route types
 */
export const rateLimitConfig = {
  // Global rate limit (default for all routes)
  global: {
    max: 100, // 100 requests
    timeWindow: '1 minute',
  },

  // Stricter limits for auth routes (prevent brute force)
  auth: {
    max: 10, // 10 requests
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate limit by IP for auth routes
      return request.ip;
    },
  },

  // Stricter limits for password-related routes
  password: {
    max: 5, // 5 requests
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      return request.ip;
    },
  },

  // More lenient for read operations
  read: {
    max: 200, // 200 requests
    timeWindow: '1 minute',
  },

  // Standard limits for write operations
  write: {
    max: 50, // 50 requests
    timeWindow: '1 minute',
  },

  // File upload limits
  upload: {
    max: 10, // 10 uploads
    timeWindow: '1 minute',
  },

  // T008: Geocoding API limits (Nominatim: 1 req/sec)
  geocoding: {
    max: 60, // 60 requests per minute = 1 req/sec
    timeWindow: '1 minute',
  },

  // T008: Cover image API limits (Pexels: 200 req/hour)
  coverImage: {
    max: 200, // 200 requests
    timeWindow: '1 hour',
  },
};

/**
 * Register rate limiting plugin with Fastify
 * @param {FastifyInstance} fastify - Fastify instance
 */
export async function registerRateLimit(fastify) {
  await fastify.register(rateLimit, {
    max: rateLimitConfig.global.max,
    timeWindow: rateLimitConfig.global.timeWindow,
    // Use Redis in production for distributed rate limiting
    // For now, use in-memory store
    cache: 10000, // Cache up to 10000 keys
    allowList: [], // IPs that bypass rate limiting
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      return request.user?.userId || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: context.after,
        limit: context.max,
        remaining: 0,
      };
    },
    onExceeded: (request, key) => {
      request.log.warn({
        msg: 'Rate limit exceeded',
        key,
        ip: request.ip,
        url: request.url,
        userId: request.user?.userId,
      });
    },
  });
}

/**
 * Route-specific rate limit options
 * Use these when registering routes that need different limits
 */
export const routeRateLimits = {
  // For login/register routes
  auth: {
    rateLimit: {
      max: rateLimitConfig.auth.max,
      timeWindow: rateLimitConfig.auth.timeWindow,
      keyGenerator: rateLimitConfig.auth.keyGenerator,
    },
  },

  // For password change/reset routes
  password: {
    rateLimit: {
      max: rateLimitConfig.password.max,
      timeWindow: rateLimitConfig.password.timeWindow,
      keyGenerator: rateLimitConfig.password.keyGenerator,
    },
  },

  // For file upload routes
  upload: {
    rateLimit: {
      max: rateLimitConfig.upload.max,
      timeWindow: rateLimitConfig.upload.timeWindow,
    },
  },

  // T008: For geocoding routes (Nominatim proxying)
  geocoding: {
    rateLimit: {
      max: rateLimitConfig.geocoding.max,
      timeWindow: rateLimitConfig.geocoding.timeWindow,
    },
  },

  // T008: For cover image generation routes
  coverImages: {
    rateLimit: {
      max: rateLimitConfig.coverImage.max,
      timeWindow: rateLimitConfig.coverImage.timeWindow,
    },
  },
};
