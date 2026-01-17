// T061: User queries module (createUser, findByEmail, findById)
// US8: Extended with role support and admin CRUD operations
import { query } from '../connection.js';

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.passwordHash - Hashed password
 * @param {string} userData.fullName - User's full name
 * @param {string} [userData.role='user'] - User role (user or admin)
 * @returns {Promise<Object>} Created user
 */
export async function createUser({ email, passwordHash, fullName, role = 'user' }) {
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, created_at, updated_at`,
    [email, passwordHash, fullName, role]
  );

  return result.rows[0];
}

/**
 * Find user by email (includes password_hash for auth)
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User or null
 */
export async function findByEmail(email) {
  const result = await query(
    `SELECT id, email, password_hash, full_name, role, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

/**
 * Find user by ID (without password)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User (without password) or null
 */
export async function findById(userId) {
  const result = await query(
    `SELECT id, email, full_name, role, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Get all users (for admin)
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Max results
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {string} [options.search] - Search by email or name
 * @returns {Promise<Object>} { users, total }
 */
export async function findAllUsers({ limit = 50, offset = 0, search = '' } = {}) {
  let whereClause = '';
  const params = [];
  let paramIndex = 1;

  if (search) {
    whereClause = `WHERE email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated results
  params.push(limit, offset);
  const result = await query(
    `SELECT id, email, full_name, role, created_at, updated_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    users: result.rows,
    total,
  };
}

/**
 * Update user profile (for self-update)
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
export async function updateUser(userId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.fullName !== undefined) {
    fields.push(`full_name = $${paramIndex++}`);
    values.push(updates.fullName);
  }

  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }

  if (updates.passwordHash !== undefined) {
    fields.push(`password_hash = $${paramIndex++}`);
    values.push(updates.passwordHash);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  // Always update updated_at
  fields.push(`updated_at = NOW()`);

  values.push(userId);

  const result = await query(
    `UPDATE users
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, email, full_name, role, created_at, updated_at`,
    values
  );

  return result.rows[0];
}

/**
 * Update user by admin (can update role)
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
export async function adminUpdateUser(userId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.fullName !== undefined) {
    fields.push(`full_name = $${paramIndex++}`);
    values.push(updates.fullName);
  }

  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }

  if (updates.passwordHash !== undefined) {
    fields.push(`password_hash = $${paramIndex++}`);
    values.push(updates.passwordHash);
  }

  if (updates.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(updates.role);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  // Always update updated_at
  fields.push(`updated_at = NOW()`);

  values.push(userId);

  const result = await query(
    `UPDATE users
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, email, full_name, role, created_at, updated_at`,
    values
  );

  return result.rows[0];
}

/**
 * Delete user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteUser(userId) {
  const result = await query(
    `DELETE FROM users WHERE id = $1`,
    [userId]
  );

  return result.rowCount > 0;
}

/**
 * Count admins in the system
 * @returns {Promise<number>} Number of admin users
 */
export async function countAdmins() {
  const result = await query(
    `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
  );
  return parseInt(result.rows[0].count, 10);
}
