// T013: Refresh token queries module
import { query } from '../connection.js';

/**
 * Store a new refresh token
 * @param {Object} tokenData - Token data
 * @param {string} tokenData.userId - User ID
 * @param {string} tokenData.tokenHash - Hashed refresh token
 * @param {string} tokenData.familyId - Token family ID for rotation tracking
 * @param {Date} tokenData.expiresAt - Token expiration date
 * @returns {Promise<Object>} Created refresh token record
 */
export async function storeRefreshToken({ userId, tokenHash, familyId, expiresAt }) {
  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, token_hash, family_id, used_at, revoked_at, expires_at, created_at`,
    [userId, tokenHash, familyId, expiresAt]
  );

  return result.rows[0];
}

/**
 * Find refresh token by token hash
 * @param {string} tokenHash - Hashed refresh token
 * @returns {Promise<Object|null>} Refresh token record or null
 */
export async function findByTokenHash(tokenHash) {
  const result = await query(
    `SELECT id, user_id, token_hash, family_id, used_at, revoked_at, expires_at, created_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

/**
 * Mark refresh token as used
 * @param {string} tokenHash - Hashed refresh token
 * @returns {Promise<Object>} Updated refresh token record
 */
export async function markAsUsed(tokenHash) {
  const result = await query(
    `UPDATE refresh_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
     RETURNING id, user_id, token_hash, family_id, used_at, revoked_at, expires_at, created_at`,
    [tokenHash]
  );

  return result.rows[0];
}

/**
 * Revoke a specific refresh token
 * @param {string} tokenHash - Hashed refresh token
 * @returns {Promise<Object>} Updated refresh token record
 */
export async function revokeToken(tokenHash) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
     RETURNING id, user_id, token_hash, family_id, used_at, revoked_at, expires_at, created_at`,
    [tokenHash]
  );

  return result.rows[0];
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeAllForUser(userId) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [userId]
  );

  return result.rowCount;
}

/**
 * Revoke all refresh tokens in a token family (for reuse detection)
 * @param {string} familyId - Token family ID
 * @returns {Promise<number>} Number of tokens revoked
 */
export async function revokeTokenFamily(familyId) {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE family_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [familyId]
  );

  return result.rowCount;
}

/**
 * Clean up expired refresh tokens (for maintenance)
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function cleanupExpired() {
  const result = await query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
     RETURNING id`
  );

  return result.rowCount;
}
