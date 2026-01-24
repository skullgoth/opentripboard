// T291: Rate limiting middleware for API protection
import rateLimit from '@fastify/rate-limit';
import { extractTokenFromHeader, decodeToken } from '../utils/jwt.js';

const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

/**
 * Extract the best available client identifier for rate limiting
 * Priority: User ID from JWT > Real client IP from X-Forwarded-For > request.ip
 * @param {Object} request - Fastify request object
 * @returns {string} Client identifier for rate limiting
 */
function getClientIdentifier(request) {
  // 1. Try to get user ID from JWT token (works for authenticated requests)
  try {
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);
      if (token) {
        const decoded = decodeToken(token);
        if (decoded?.userId) {
          return `user:${decoded.userId}`;
        }
      }
    }
  } catch (err) {
    // Ignore token extraction errors, fall back to IP
  }

  // 2. Try to get real client IP from X-Forwarded-For header
  // This is set by nginx/load balancers with the original client IP
  const forwardedFor = request.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list: "client, proxy1, proxy2"
    // The first IP is the original client
    const clientIp = forwardedFor.split(',')[0].trim();
    if (clientIp && clientIp !== request.ip) {
      return `ip:${clientIp}`;
    }
  }

  // 3. Try X-Real-IP header (alternative to X-Forwarded-For)
  const realIp = request.headers?.['x-real-ip'];
  if (realIp && realIp !== request.ip) {
    return `ip:${realIp}`;
  }

  // 4. Fall back to request.ip (may be Docker network IP in containerized environments)
  if (request.ip) {
    return `ip:${request.ip}`;
  }

  // 5. Ultimate fallback - should never happen
  return `unknown:${Date.now()}`;
}

/**
 * Rate limiting configuration
 * Different limits for different route types
 */
export const rateLimitConfig = {
  // Global rate limit (default for all routes)
  global: {
    max: 100, // 100 requests per minute per client
    timeWindow: '1 minute',
  },

  // Stricter limits for auth routes (prevent brute force)
  auth: {
    max: 10, // 10 requests
    timeWindow: '1 minute',
    // Auth routes use IP-based limiting (no JWT available yet)
    // Uses X-Forwarded-For to get real client IP in Docker/proxy setups
    keyGenerator: (request) => {
      const forwardedFor = request.headers?.['x-forwarded-for'];
      if (forwardedFor) {
        return `auth:${forwardedFor.split(',')[0].trim()}`;
      }
      const realIp = request.headers?.['x-real-ip'];
      if (realIp) {
        return `auth:${realIp}`;
      }
      return `auth:${request.ip || 'unknown'}`;
    },
  },

  // Stricter limits for password-related routes
  password: {
    max: 5, // 5 requests
    timeWindow: '15 minutes',
    keyGenerator: (request) => {
      const forwardedFor = request.headers?.['x-forwarded-for'];
      if (forwardedFor) {
        return `pwd:${forwardedFor.split(',')[0].trim()}`;
      }
      const realIp = request.headers?.['x-real-ip'];
      if (realIp) {
        return `pwd:${realIp}`;
      }
      return `pwd:${request.ip || 'unknown'}`;
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
  // Allow completely disabling rate limiting (useful for development/testing)
  if (RATE_LIMIT_DISABLED) {
    fastify.log.info('Rate limiting is disabled via RATE_LIMIT_DISABLED env var');
    return;
  }

  fastify.log.info(`Rate limiting enabled: ${rateLimitConfig.global.max} requests per ${rateLimitConfig.global.timeWindow}`);

  await fastify.register(rateLimit, {
    max: rateLimitConfig.global.max,
    timeWindow: rateLimitConfig.global.timeWindow,
    // Use Redis in production for distributed rate limiting
    // For now, use in-memory store
    cache: 10000, // Cache up to 10000 keys
    allowList: [], // IPs that bypass rate limiting
    keyGenerator: (request) => {
      try {
        const key = getClientIdentifier(request);
        // Log the key being used (helpful for debugging rate limit issues)
        if (process.env.DEBUG_RATE_LIMIT === 'true') {
          console.log(`Rate limit key: ${key} for ${request.method} ${request.url}`);
        }
        return key;
      } catch (err) {
        // Safety fallback if any error occurs - use unique key to avoid blocking
        console.error('Rate limit keyGenerator error:', err.message);
        return `error:${Date.now()}-${Math.random()}`;
      }
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: context?.after || 60,
        limit: context?.max || 100,
        remaining: 0,
      };
    },
    onExceeded: (request, key) => {
      try {
        console.warn('Rate limit exceeded:', {
          key,
          ip: request.ip,
          url: request.url,
          userId: request.user?.userId,
        });
      } catch (err) {
        // Ignore logging errors to prevent request failure
        console.warn('Rate limit logging failed:', err.message);
      }
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
