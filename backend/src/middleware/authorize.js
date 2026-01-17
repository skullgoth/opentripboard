// T032: Authorization middleware - check trip access and roles
import logger from '../utils/logger.js';
import { query } from '../db/connection.js';

/**
 * Check if user has access to a trip
 * @param {string} userId - User ID
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object|null>} Trip access info or null if no access
 */
async function checkTripAccess(userId, tripId) {
  // Check if user is the owner
  const ownerResult = await query(
    'SELECT id, owner_id FROM trips WHERE id = $1 AND owner_id = $2',
    [tripId, userId]
  );

  if (ownerResult.rows.length > 0) {
    return {
      tripId,
      role: 'owner',
      hasAccess: true,
    };
  }

  // Check if user is a trip buddy
  const tripBuddyResult = await query(
    `SELECT trip_id, role
     FROM trip_buddies
     WHERE trip_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
    [tripId, userId]
  );

  if (tripBuddyResult.rows.length > 0) {
    return {
      tripId,
      role: tripBuddyResult.rows[0].role,
      hasAccess: true,
    };
  }

  return null;
}

/**
 * Middleware to require trip access
 * Expects tripId as a route parameter
 */
export async function requireTripAccess(request, reply) {
  try {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const tripId = request.params.tripId || request.params.id;

    if (!tripId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Trip ID is required',
      });
    }

    const access = await checkTripAccess(request.user.userId, tripId);

    if (!access) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this trip',
      });
    }

    // Attach trip access info to request
    request.tripAccess = access;

  } catch (error) {
    logger.error('Authorization middleware error', { error });
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authorization check failed',
    });
  }
}

/**
 * Middleware to require specific role for trip access
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['owner', 'editor'])
 */
export function requireRole(allowedRoles) {
  return async function (request, reply) {
    try {
      // First ensure trip access is checked
      await requireTripAccess(request, reply);

      if (reply.sent) {
        // Access was denied in requireTripAccess
        return;
      }

      const userRole = request.tripAccess.role;

      if (!allowedRoles.includes(userRole)) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        });
      }

    } catch (error) {
      logger.error('Role authorization error', { error });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Authorization check failed',
      });
    }
  };
}

/**
 * Middleware to require trip ownership
 * Shorthand for requireRole(['owner'])
 */
export const requireOwnership = requireRole(['owner']);

/**
 * Middleware to require edit permission
 * Shorthand for requireRole(['owner', 'editor'])
 */
export const requireEditPermission = requireRole(['owner', 'editor']);

/**
 * Helper function to check if user owns a resource
 * @param {string} table - Table name
 * @param {string} resourceId - Resource ID
 * @param {string} userId - User ID
 * @param {string} ownerColumn - Column name for owner (default: 'owner_id')
 * @returns {Promise<boolean>} True if user owns resource
 */
export async function checkResourceOwnership(
  table,
  resourceId,
  userId,
  ownerColumn = 'owner_id'
) {
  const result = await query(
    `SELECT id FROM ${table} WHERE id = $1 AND ${ownerColumn} = $2`,
    [resourceId, userId]
  );

  return result.rows.length > 0;
}
