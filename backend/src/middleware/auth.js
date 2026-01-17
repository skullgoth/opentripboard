// T031: Authentication middleware - verify JWT and attach user to request
// US8: Extended with RBAC admin middleware
import logger from '../utils/logger.js';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';

/**
 * Middleware to authenticate requests using JWT
 * Extracts token from Authorization header, verifies it, and attaches user to request
 */
export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: error.message || 'Invalid authentication token',
      });
    }

    // Verify token type
    if (decoded.type !== 'access') {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    }

    // Attach user information to request (including role for RBAC)
    request.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
    };

  } catch (error) {
    logger.error('Authentication middleware error', { error });
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuthenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without user
      request.user = null;
      return;
    }

    try {
      const decoded = verifyToken(token);

      if (decoded.type === 'access') {
        request.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role || 'user',
        };
      } else {
        request.user = null;
      }
    } catch (error) {
      // Invalid token, continue without user
      request.user = null;
    }
  } catch (error) {
    logger.error('Optional authentication middleware error', { error });
    request.user = null;
  }
}

/**
 * US8: Middleware to require admin role
 * Must be used after authenticate middleware
 */
export async function requireAdmin(request, reply) {
  if (!request.user) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (request.user.role !== 'admin') {
    logger.warn('Admin access denied', {
      userId: request.user.userId,
      role: request.user.role,
      path: request.url,
    });
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
}

/**
 * US8: Middleware factory to require specific roles
 * @param {string[]} allowedRoles - Array of allowed roles
 */
export function requireRole(...allowedRoles) {
  return async function(request, reply) {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      logger.warn('Role access denied', {
        userId: request.user.userId,
        userRole: request.user.role,
        requiredRoles: allowedRoles,
        path: request.url,
      });
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Access requires one of: ${allowedRoles.join(', ')}`,
      });
    }
  };
}
