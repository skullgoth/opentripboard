/**
 * Database queries for trip_buddies
 * Task: T091 [P] [US2] Create trip_buddy queries
 */

import { getPool } from '../connection.js';

const pool = getPool();

/**
 * Invite a trip_buddy to a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID to invite
 * @param {string} role - Role ('editor' | 'viewer')
 * @param {string} invitedBy - User UUID who sent invitation
 * @returns {Promise<Object>} Created trip_buddy record
 */
export async function invite(tripId, userId, role, invitedBy) {
  const query = `
    INSERT INTO trip_buddies (trip_id, user_id, role, invited_by, invited_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `;

  const result = await pool.query(query, [tripId, userId, role, invitedBy]);
  return result.rows[0];
}

/**
 * Find all trip_buddies for a trip
 * @param {string} tripId - Trip UUID
 * @returns {Promise<Array>} Array of trip_buddy records with user info
 */
export async function findByTripId(tripId) {
  const query = `
    SELECT
      c.*,
      u.email,
      u.full_name
    FROM trip_buddies c
    JOIN users u ON c.user_id = u.id
    WHERE c.trip_id = $1
    ORDER BY c.role DESC, c.invited_at ASC
  `;

  const result = await pool.query(query, [tripId]);
  return result.rows;
}

/**
 * Find all trips a user has access to (as trip_buddy)
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of trip records with collaboration info
 */
export async function findByUserId(userId) {
  const query = `
    SELECT
      c.*,
      t.name as trip_name,
      t.destination,
      t.start_date,
      t.end_date,
      t.owner_id,
      u.full_name as owner_name
    FROM trip_buddies c
    JOIN trips t ON c.trip_id = t.id
    JOIN users u ON t.owner_id = u.id
    WHERE c.user_id = $1
    ORDER BY t.start_date DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Find a specific trip_buddy record
 * @param {string} trip_buddyId - Trip buddy UUID
 * @returns {Promise<Object|null>} Trip buddy record or null
 */
export async function findById(trip_buddyId) {
  const query = `
    SELECT * FROM trip_buddies WHERE id = $1
  `;

  const result = await pool.query(query, [trip_buddyId]);
  return result.rows[0] || null;
}

/**
 * Check if a user is a trip_buddy on a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Trip buddy record or null
 */
export async function findByTripAndUser(tripId, userId) {
  const query = `
    SELECT * FROM trip_buddies
    WHERE trip_id = $1 AND user_id = $2
  `;

  const result = await pool.query(query, [tripId, userId]);
  return result.rows[0] || null;
}

/**
 * Update trip_buddy accepted_at timestamp (when they accept invitation)
 * @param {string} trip_buddyId - Trip buddy UUID
 * @returns {Promise<Object>} Updated trip_buddy record
 */
export async function markAsAccepted(trip_buddyId) {
  const query = `
    UPDATE trip_buddies
    SET accepted_at = NOW()
    WHERE id = $1 AND accepted_at IS NULL
    RETURNING *
  `;

  const result = await pool.query(query, [trip_buddyId]);
  return result.rows[0];
}

/**
 * Update trip_buddy role
 * @param {string} trip_buddyId - Trip buddy UUID
 * @param {string} newRole - New role ('owner' | 'editor' | 'viewer')
 * @returns {Promise<Object>} Updated trip_buddy record
 */
export async function updateRole(trip_buddyId, newRole) {
  const query = `
    UPDATE trip_buddies
    SET role = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [newRole, trip_buddyId]);
  return result.rows[0];
}

/**
 * Remove a trip_buddy from a trip
 * @param {string} trip_buddyId - Trip buddy UUID
 * @returns {Promise<boolean>} True if deleted
 */
export async function remove(trip_buddyId) {
  const query = `
    DELETE FROM trip_buddies WHERE id = $1
  `;

  const result = await pool.query(query, [trip_buddyId]);
  return result.rowCount > 0;
}

/**
 * Remove all trip_buddies from a trip (used when deleting trip)
 * @param {string} tripId - Trip UUID
 * @returns {Promise<number>} Number of trip_buddies removed
 */
export async function removeAllByTripId(tripId) {
  const query = `
    DELETE FROM trip_buddies WHERE trip_id = $1
  `;

  const result = await pool.query(query, [tripId]);
  return result.rowCount;
}

/**
 * Check if user has specific role on trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @param {string} role - Required role ('owner' | 'editor' | 'viewer')
 * @returns {Promise<boolean>} True if user has role
 */
export async function hasRole(tripId, userId, role) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM trip_buddies
      WHERE trip_id = $1 AND user_id = $2 AND role = $3
    ) as has_role
  `;

  const result = await pool.query(query, [tripId, userId, role]);
  return result.rows[0].has_role;
}

/**
 * Check if user has any access to trip (any role)
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>} True if user has access
 */
export async function hasAccess(tripId, userId) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM trip_buddies
      WHERE trip_id = $1 AND user_id = $2
    ) as has_access
  `;

  const result = await pool.query(query, [tripId, userId]);
  return result.rows[0].has_access;
}

/**
 * Get trip_buddy count for a trip
 * @param {string} tripId - Trip UUID
 * @returns {Promise<number>} Number of trip_buddies
 */
export async function countByTripId(tripId) {
  const query = `
    SELECT COUNT(*) as count FROM trip_buddies WHERE trip_id = $1
  `;

  const result = await pool.query(query, [tripId]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get pending invitations for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of pending invitations with trip info
 */
export async function findPendingInvitations(userId) {
  const query = `
    SELECT
      c.*,
      t.name as trip_name,
      t.destination,
      t.start_date,
      t.end_date,
      u.full_name as invited_by_name
    FROM trip_buddies c
    JOIN trips t ON c.trip_id = t.id
    LEFT JOIN users u ON c.invited_by = u.id
    WHERE c.user_id = $1 AND c.accepted_at IS NULL
    ORDER BY c.invited_at DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
}
