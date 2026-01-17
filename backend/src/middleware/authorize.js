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
 * Whitelist of allowed tables and their valid owner column names
 *
 * SECURITY MODEL:
 * This whitelist prevents SQL injection attacks by ensuring that only known-safe
 * table and column names can be used in dynamically constructed SQL queries.
 * The checkResourceOwnership function validates all table and column parameters
 * against this whitelist before constructing any SQL queries.
 *
 * WHY THIS IS NECESSARY:
 * SQL injection can occur when user-controlled input is concatenated into SQL queries.
 * While parameterized queries ($1, $2) protect against injection in VALUES, they cannot
 * be used for table or column names. This whitelist provides defense-in-depth by
 * explicitly validating table and column names before query construction.
 *
 * ALLOWED TABLE/COLUMN COMBINATIONS:
 * - trips: owner_id
 * - activities: created_by, updated_by
 * - suggestions: suggested_by_user_id, resolved_by
 * - expenses: payer_id
 * - lists: created_by
 * - documents: uploaded_by
 * - users: id
 *
 * WARNING: Only add new table/column combinations after careful security review.
 * Each combination must be:
 * 1. A legitimate use case for ownership checking
 * 2. A real table and column in the database schema
 * 3. Free from any user-controlled input that could influence the name
 *
 * @type {Object.<string, string[]>}
 * @constant
 * @private
 */
const ALLOWED_RESOURCES = {
  trips: ['owner_id'],
  activities: ['created_by', 'updated_by'],
  suggestions: ['suggested_by_user_id', 'resolved_by'],
  expenses: ['payer_id'],
  lists: ['created_by'],
  documents: ['uploaded_by'],
  users: ['id'],
};

/**
 * Helper function to check if user owns a resource
 *
 * SECURITY WARNING:
 * This function constructs SQL queries with dynamic table and column names.
 * To prevent SQL injection, it uses a strict whitelist approach defined in
 * ALLOWED_RESOURCES. All table and ownerColumn parameters are validated
 * against this whitelist BEFORE any SQL query is constructed.
 *
 * WHITELIST APPROACH:
 * - Only tables defined in ALLOWED_RESOURCES are accepted
 * - Only columns listed for each specific table are accepted
 * - Invalid inputs throw descriptive errors before query construction
 * - Validation happens even for hardcoded caller values (defense-in-depth)
 *
 * ALLOWED COMBINATIONS:
 * - checkResourceOwnership('trips', id, userId) - uses default 'owner_id'
 * - checkResourceOwnership('activities', id, userId, 'created_by')
 * - checkResourceOwnership('activities', id, userId, 'updated_by')
 * - checkResourceOwnership('suggestions', id, userId, 'suggested_by_user_id')
 * - checkResourceOwnership('suggestions', id, userId, 'resolved_by')
 * - checkResourceOwnership('expenses', id, userId, 'payer_id')
 * - checkResourceOwnership('lists', id, userId, 'created_by')
 * - checkResourceOwnership('documents', id, userId, 'uploaded_by')
 * - checkResourceOwnership('users', id, userId, 'id')
 *
 * EXAMPLE USAGE:
 * ```javascript
 * // Check if user owns a trip
 * const ownsTrip = await checkResourceOwnership('trips', tripId, userId);
 *
 * // Check if user created an activity
 * const createdActivity = await checkResourceOwnership(
 *   'activities',
 *   activityId,
 *   userId,
 *   'created_by'
 * );
 *
 * // INVALID - throws error (table not in whitelist)
 * await checkResourceOwnership('passwords', id, userId); // Error!
 *
 * // INVALID - throws error (column not valid for this table)
 * await checkResourceOwnership('trips', id, userId, 'created_by'); // Error!
 * ```
 *
 * @param {string} table - Table name (must be in ALLOWED_RESOURCES)
 * @param {string} resourceId - Resource ID to check ownership of
 * @param {string} userId - User ID to check against
 * @param {string} [ownerColumn='owner_id'] - Column name for owner (must be valid for the table)
 * @returns {Promise<boolean>} True if user owns the resource, false otherwise
 * @throws {Error} If table is not in ALLOWED_RESOURCES whitelist
 * @throws {Error} If ownerColumn is not valid for the specified table
 */
export async function checkResourceOwnership(
  table,
  resourceId,
  userId,
  ownerColumn = 'owner_id'
) {
  // Validate table name against whitelist
  if (!ALLOWED_RESOURCES[table]) {
    throw new Error(`Invalid table name: ${table}. Allowed tables: ${Object.keys(ALLOWED_RESOURCES).join(', ')}`);
  }

  // Validate column name against whitelist for this table
  if (!ALLOWED_RESOURCES[table].includes(ownerColumn)) {
    throw new Error(`Invalid owner column: ${ownerColumn} for table ${table}. Allowed columns: ${ALLOWED_RESOURCES[table].join(', ')}`);
  }

  // Safe to use table and ownerColumn in query since they've been validated
  const result = await query(
    `SELECT id FROM ${table} WHERE id = $1 AND ${ownerColumn} = $2`,
    [resourceId, userId]
  );

  return result.rows.length > 0;
}
