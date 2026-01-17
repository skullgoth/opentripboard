// US9: Share tokens queries for public trip sharing
import { query } from '../connection.js';
import crypto from 'crypto';

/**
 * Generate a secure random token
 * @returns {string} 32-character hex token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a share token for a trip
 * @param {Object} data - Token data
 * @param {string} data.tripId - Trip ID
 * @param {string} data.createdBy - User ID who created the token
 * @param {string} [data.permission='view'] - Permission level (view or edit)
 * @param {Date} [data.expiresAt] - Optional expiration date
 * @returns {Promise<Object>} Created share token
 */
export async function createShareToken({ tripId, createdBy, permission = 'view', expiresAt = null }) {
  const token = generateToken();

  const result = await query(
    `INSERT INTO share_tokens (trip_id, token, permission, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, trip_id, token, permission, created_by, expires_at, created_at`,
    [tripId, token, permission, createdBy, expiresAt]
  );

  return result.rows[0];
}

/**
 * Find share token by token string
 * @param {string} token - Token string
 * @returns {Promise<Object|null>} Share token with trip details or null
 */
export async function findByToken(token) {
  const result = await query(
    `SELECT st.*, t.name as trip_name, t.destination, t.start_date, t.end_date,
            t.cover_image_url, t.budget, t.currency, t.owner_id,
            u.full_name as owner_name, u.email as owner_email
     FROM share_tokens st
     JOIN trips t ON st.trip_id = t.id
     JOIN users u ON t.owner_id = u.id
     WHERE st.token = $1
       AND (st.expires_at IS NULL OR st.expires_at > NOW())`,
    [token]
  );

  return result.rows[0] || null;
}

/**
 * Find all share tokens for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Array>} List of share tokens
 */
export async function findByTripId(tripId) {
  const result = await query(
    `SELECT st.*, u.full_name as created_by_name, u.email as created_by_email
     FROM share_tokens st
     JOIN users u ON st.created_by = u.id
     WHERE st.trip_id = $1
     ORDER BY st.created_at DESC`,
    [tripId]
  );

  return result.rows;
}

/**
 * Delete a share token
 * @param {string} tokenId - Token ID
 * @param {string} tripId - Trip ID (for ownership verification)
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteShareToken(tokenId, tripId) {
  const result = await query(
    `DELETE FROM share_tokens WHERE id = $1 AND trip_id = $2`,
    [tokenId, tripId]
  );

  return result.rowCount > 0;
}

/**
 * Delete all share tokens for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function deleteAllByTripId(tripId) {
  const result = await query(
    `DELETE FROM share_tokens WHERE trip_id = $1`,
    [tripId]
  );

  return result.rowCount;
}

/**
 * Update share token permission
 * @param {string} tokenId - Token ID
 * @param {string} tripId - Trip ID
 * @param {string} permission - New permission level
 * @returns {Promise<Object|null>} Updated token or null
 */
export async function updatePermission(tokenId, tripId, permission) {
  const result = await query(
    `UPDATE share_tokens
     SET permission = $1, updated_at = NOW()
     WHERE id = $2 AND trip_id = $3
     RETURNING *`,
    [permission, tokenId, tripId]
  );

  return result.rows[0] || null;
}
