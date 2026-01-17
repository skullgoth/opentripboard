// User categories database queries

import { query } from '../connection.js';

/**
 * Valid domains for categories
 */
export const VALID_DOMAINS = ['activity', 'reservation', 'expense', 'document'];

/**
 * Maximum number of custom categories per user
 */
export const MAX_CATEGORIES_PER_USER = 100;

/**
 * Get all custom categories for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of category objects
 */
export async function getUserCategories(userId) {
  const result = await query(
    `SELECT id, user_id, name, icon, domain, created_at, updated_at
     FROM user_categories
     WHERE user_id = $1
     ORDER BY domain, name`,
    [userId]
  );
  return result.rows;
}

/**
 * Get custom categories for a user filtered by domain
 * @param {string} userId - User UUID
 * @param {string} domain - Category domain (activity, reservation, expense, document)
 * @returns {Promise<Array>} Array of category objects
 */
export async function getUserCategoriesByDomain(userId, domain) {
  const result = await query(
    `SELECT id, user_id, name, icon, domain, created_at, updated_at
     FROM user_categories
     WHERE user_id = $1 AND domain = $2
     ORDER BY name`,
    [userId, domain]
  );
  return result.rows;
}

/**
 * Get a single category by ID
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object|null>} Category object or null if not found
 */
export async function getCategoryById(categoryId) {
  const result = await query(
    `SELECT id, user_id, name, icon, domain, created_at, updated_at
     FROM user_categories
     WHERE id = $1`,
    [categoryId]
  );
  return result.rows[0] || null;
}

/**
 * Count the number of custom categories for a user
 * @param {string} userId - User UUID
 * @returns {Promise<number>} Count of categories
 */
export async function countUserCategories(userId) {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM user_categories
     WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Create a new custom category
 * @param {string} userId - User UUID
 * @param {Object} category - Category data { name, icon, domain }
 * @returns {Promise<Object>} Created category object
 */
export async function createCategory(userId, { name, icon, domain }) {
  const result = await query(
    `INSERT INTO user_categories (user_id, name, icon, domain)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, icon, domain, created_at, updated_at`,
    [userId, name.trim(), icon.trim(), domain]
  );
  return result.rows[0];
}

/**
 * Update an existing category
 * @param {string} categoryId - Category UUID
 * @param {Object} updates - Fields to update { name?, icon? }
 * @returns {Promise<Object|null>} Updated category or null if not found
 */
export async function updateCategory(categoryId, { name, icon }) {
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }
  if (icon !== undefined) {
    updates.push(`icon = $${paramIndex++}`);
    values.push(icon.trim());
  }

  if (updates.length === 0) {
    // No updates provided, just return the current category
    return getCategoryById(categoryId);
  }

  values.push(categoryId);

  const result = await query(
    `UPDATE user_categories
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, user_id, name, icon, domain, created_at, updated_at`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Delete a category
 * @param {string} categoryId - Category UUID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteCategory(categoryId) {
  const result = await query(
    `DELETE FROM user_categories
     WHERE id = $1
     RETURNING id`,
    [categoryId]
  );
  return result.rows.length > 0;
}

/**
 * Get the category reference string for storage
 * @param {string} categoryId - Category UUID
 * @returns {string} Reference string in format 'custom:{uuid}'
 */
export function getCategoryRef(categoryId) {
  return `custom:${categoryId}`;
}

/**
 * Check if a category reference is a custom category
 * @param {string} value - Category value from item
 * @returns {boolean} True if custom category
 */
export function isCustomCategory(value) {
  return value && value.startsWith('custom:');
}

/**
 * Extract UUID from a custom category reference
 * @param {string} value - Category reference string
 * @returns {string|null} UUID or null if not a custom category
 */
export function extractCategoryId(value) {
  if (!isCustomCategory(value)) {
    return null;
  }
  return value.substring(7);
}

/**
 * Count how many items use a specific custom category across all tables
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Usage counts by table { expenses, activities, documents, total }
 */
export async function getCategoryUsageCount(categoryId) {
  const ref = getCategoryRef(categoryId);

  // Query all tables that can have category references
  // Note: documents table uses 'category' column, activities uses 'type'
  // Note: reservations are stored in the activities table (no separate reservations table)
  const [expensesResult, activitiesResult, documentsResult] = await Promise.all([
    query(`SELECT COUNT(*) as count FROM expenses WHERE category = $1`, [ref]),
    query(`SELECT COUNT(*) as count FROM activities WHERE type = $1`, [ref]),
    query(`SELECT COUNT(*) as count FROM documents WHERE category = $1`, [ref]),
  ]);

  const expenses = parseInt(expensesResult.rows[0].count, 10);
  const activities = parseInt(activitiesResult.rows[0].count, 10);
  const documents = parseInt(documentsResult.rows[0].count, 10);

  return {
    expenses,
    activities,
    reservations: 0, // Reservations are stored in activities table
    documents,
    total: expenses + activities + documents,
  };
}

/**
 * Reassign all items using a category to the default 'other' category
 * @param {string} categoryId - Category UUID to reassign from
 * @returns {Promise<Object>} Count of items reassigned by table
 */
export async function reassignCategoryToOther(categoryId) {
  const ref = getCategoryRef(categoryId);

  // Note: documents table uses 'category' column, activities uses 'type'
  // Note: reservations are stored in the activities table (no separate reservations table)
  const [expensesResult, activitiesResult, documentsResult] = await Promise.all([
    query(`UPDATE expenses SET category = 'other' WHERE category = $1 RETURNING id`, [ref]),
    query(`UPDATE activities SET type = 'other' WHERE type = $1 RETURNING id`, [ref]),
    query(`UPDATE documents SET category = 'other' WHERE category = $1 RETURNING id`, [ref]),
  ]);

  return {
    expenses: expensesResult.rows.length,
    activities: activitiesResult.rows.length,
    reservations: 0, // Reservations are stored in activities table
    documents: documentsResult.rows.length,
  };
}

/**
 * Delete a category with item reassignment (atomic transaction)
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Result with deleted flag and reassigned counts
 */
export async function deleteCategoryWithReassignment(categoryId) {
  // First reassign all items to 'other'
  const reassigned = await reassignCategoryToOther(categoryId);

  // Then delete the category
  const deleted = await deleteCategory(categoryId);

  return {
    deleted,
    reassigned,
  };
}

/**
 * Validate category data
 * @param {Object} category - Category data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateCategory({ name, icon, domain }) {
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string') {
    errors.push('Category name is required');
  } else {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      errors.push('Category name cannot be empty');
    } else if (trimmedName.length > 50) {
      errors.push('Category name must be 50 characters or less');
    }
  }

  // Icon validation
  if (!icon || typeof icon !== 'string') {
    errors.push('Category icon is required');
  } else {
    const trimmedIcon = icon.trim();
    if (trimmedIcon.length === 0) {
      errors.push('Category icon cannot be empty');
    } else if (trimmedIcon.length > 10) {
      errors.push('Category icon must be 10 characters or less');
    }
  }

  // Domain validation
  if (!domain || typeof domain !== 'string') {
    errors.push('Category domain is required');
  } else if (!VALID_DOMAINS.includes(domain)) {
    errors.push(`Invalid domain: ${domain}. Valid values: ${VALID_DOMAINS.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
