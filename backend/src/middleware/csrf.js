// CSRF protection middleware using double-submit cookie pattern
// Note: JWT-based APIs with Authorization headers are not vulnerable to traditional CSRF
// This provides defense-in-depth protection

import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

// Methods that modify state and should be protected
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Routes that should be excluded from CSRF protection (public endpoints)
const EXCLUDED_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/shared/', // Public shared trip access
  '/health',
];

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Check if a route should be excluded from CSRF protection
 * @param {string} url
 * @returns {boolean}
 */
function isExcludedRoute(url) {
  return EXCLUDED_ROUTES.some((route) => url.startsWith(route));
}

/**
 * CSRF protection plugin for Fastify
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
export async function csrfPlugin(fastify, options = {}) {
  const {
    enabled = process.env.CSRF_ENABLED !== 'false',
    cookieOptions = {},
  } = options;

  // Skip if CSRF is disabled
  if (!enabled) {
    fastify.log.info('CSRF protection is disabled');
    return;
  }

  fastify.log.info('CSRF protection is enabled');

  // Register cookie plugin if not already registered
  if (!fastify.hasDecorator('cookies')) {
    await fastify.register(import('@fastify/cookie'));
  }

  // Add CSRF token generation route
  fastify.get('/api/v1/csrf-token', async (request, reply) => {
    const token = generateToken();

    // Set token in cookie (httpOnly: false so JS can read it if needed)
    reply.setCookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      ...cookieOptions,
    });

    return { csrfToken: token };
  });

  // Add preHandler hook to verify CSRF token on protected methods
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip for non-protected methods
    if (!PROTECTED_METHODS.includes(request.method)) {
      return;
    }

    // Skip for excluded routes
    if (isExcludedRoute(request.url)) {
      return;
    }

    // Skip for WebSocket upgrade requests
    if (request.headers.upgrade === 'websocket') {
      return;
    }

    // Get token from cookie and header
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME];

    // Both must be present and match
    if (!cookieToken || !headerToken) {
      fastify.log.warn({
        msg: 'CSRF token missing',
        url: request.url,
        method: request.method,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
      });

      reply.code(403).send({
        error: 'Forbidden',
        message: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      });
      return;
    }

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      fastify.log.warn({
        msg: 'CSRF token mismatch',
        url: request.url,
        method: request.method,
      });

      reply.code(403).send({
        error: 'Forbidden',
        message: 'CSRF token invalid',
        code: 'CSRF_TOKEN_INVALID',
      });
      return;
    }
  });
}

export default csrfPlugin;
