// Category service - business logic for user custom categories

import {
  getUserCategories,
  getUserCategoriesByDomain,
  getCategoryById,
  countUserCategories,
  createCategory as dbCreateCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  getCategoryUsageCount,
  deleteCategoryWithReassignment,
  validateCategory,
  getCategoryRef,
  isCustomCategory,
  extractCategoryId,
  VALID_DOMAINS,
  MAX_CATEGORIES_PER_USER,
} from '../db/queries/categories.js';
import {
  getDefaultCategories,
  getDefaultCategoriesByDomain,
  findDefaultCategory,
} from '../utils/default-categories.js';

/**
 * Get all categories (defaults + custom) for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Object with defaults and custom categories by domain
 */
export async function getCategories(userId) {
  const [customCategories, defaults] = await Promise.all([
    getUserCategories(userId),
    Promise.resolve(getDefaultCategories()),
  ]);

  // Organize custom categories by domain
  const customByDomain = {
    activity: [],
    reservation: [],
    expense: [],
    document: [],
  };

  for (const category of customCategories) {
    if (customByDomain[category.domain]) {
      customByDomain[category.domain].push({
        id: category.id,
        name: category.name,
        icon: category.icon,
        isCustom: true,
        ref: getCategoryRef(category.id),
      });
    }
  }

  return {
    defaults,
    custom: customByDomain,
  };
}

/**
 * Get categories for a specific domain
 * @param {string} userId - User UUID
 * @param {string} domain - Category domain
 * @returns {Promise<Object>} Object with defaults and custom categories
 */
export async function getCategoriesByDomain(userId, domain) {
  if (!VALID_DOMAINS.includes(domain)) {
    const error = new Error(`Invalid domain: ${domain}`);
    error.statusCode = 400;
    throw error;
  }

  const [customCategories, defaults] = await Promise.all([
    getUserCategoriesByDomain(userId, domain),
    Promise.resolve(getDefaultCategoriesByDomain(domain)),
  ]);

  const custom = customCategories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    isCustom: true,
    ref: getCategoryRef(category.id),
  }));

  return {
    defaults,
    custom,
  };
}

/**
 * Get categories for a trip (uses trip owner's categories)
 * @param {string} ownerId - Trip owner's user UUID
 * @returns {Promise<Object>} Object with defaults and custom categories by domain
 */
export async function getTripCategories(ownerId) {
  // Collaborators get the trip owner's custom categories
  return getCategories(ownerId);
}

/**
 * Create a new custom category
 * @param {string} userId - User UUID
 * @param {Object} categoryData - Category data { name, icon, domain }
 * @returns {Promise<Object>} Created category
 */
export async function createCategory(userId, categoryData) {
  // Validate the category data
  const validation = validateCategory(categoryData);
  if (!validation.valid) {
    const error = new Error(validation.errors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  // Check category limit
  const currentCount = await countUserCategories(userId);
  if (currentCount >= MAX_CATEGORIES_PER_USER) {
    const error = new Error(`Maximum of ${MAX_CATEGORIES_PER_USER} custom categories reached`);
    error.statusCode = 400;
    throw error;
  }

  // Create the category
  const category = await dbCreateCategory(userId, categoryData);

  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    domain: category.domain,
    isCustom: true,
    ref: getCategoryRef(category.id),
    created_at: category.created_at,
  };
}

/**
 * Update a custom category
 * @param {string} userId - User UUID (for ownership verification)
 * @param {string} categoryId - Category UUID
 * @param {Object} updates - Fields to update { name?, icon? }
 * @returns {Promise<Object>} Updated category
 */
export async function updateCategory(userId, categoryId, updates) {
  // Get the category to verify ownership
  const category = await getCategoryById(categoryId);
  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  if (category.user_id !== userId) {
    const error = new Error('You can only edit your own categories');
    error.statusCode = 403;
    throw error;
  }

  // Validate updates (partial validation)
  const errors = [];
  if (updates.name !== undefined) {
    const trimmedName = updates.name?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      errors.push('Category name cannot be empty');
    } else if (trimmedName.length > 50) {
      errors.push('Category name must be 50 characters or less');
    }
  }
  if (updates.icon !== undefined) {
    const trimmedIcon = updates.icon?.trim();
    if (!trimmedIcon || trimmedIcon.length === 0) {
      errors.push('Category icon cannot be empty');
    } else if (trimmedIcon.length > 10) {
      errors.push('Category icon must be 10 characters or less');
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  // Update the category
  const updated = await dbUpdateCategory(categoryId, updates);

  return {
    id: updated.id,
    name: updated.name,
    icon: updated.icon,
    domain: updated.domain,
    isCustom: true,
    ref: getCategoryRef(updated.id),
    updated_at: updated.updated_at,
  };
}

/**
 * Delete a custom category
 * @param {string} userId - User UUID (for ownership verification)
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Deletion result with reassignment info
 */
export async function deleteCategory(userId, categoryId) {
  // Get the category to verify ownership
  const category = await getCategoryById(categoryId);
  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  if (category.user_id !== userId) {
    const error = new Error('You can only delete your own categories');
    error.statusCode = 403;
    throw error;
  }

  // Delete with reassignment
  const result = await deleteCategoryWithReassignment(categoryId);

  return {
    deleted: result.deleted,
    reassigned: result.reassigned,
  };
}

/**
 * Get usage count for a category
 * @param {string} userId - User UUID (for ownership verification)
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Usage counts by table
 */
export async function getUsageCount(userId, categoryId) {
  // Get the category to verify ownership
  const category = await getCategoryById(categoryId);
  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  if (category.user_id !== userId) {
    const error = new Error('You can only view usage of your own categories');
    error.statusCode = 403;
    throw error;
  }

  return getCategoryUsageCount(categoryId);
}

/**
 * Resolve a category value to display info
 * @param {string} categoryValue - Category value from item (key or 'custom:uuid')
 * @param {string} domain - Category domain
 * @param {Array} userCategories - User's custom categories (optional, for optimization)
 * @returns {Promise<Object>} Resolved category { name, icon, isCustom, key? }
 */
export async function resolveCategory(categoryValue, domain, userCategories = null) {
  if (isCustomCategory(categoryValue)) {
    const categoryId = extractCategoryId(categoryValue);

    // If userCategories provided, search there first
    if (userCategories) {
      const custom = userCategories.find((c) => c.id === categoryId);
      if (custom) {
        return {
          name: custom.name,
          icon: custom.icon,
          isCustom: true,
          id: custom.id,
        };
      }
    } else {
      // Fetch from database
      const custom = await getCategoryById(categoryId);
      if (custom) {
        return {
          name: custom.name,
          icon: custom.icon,
          isCustom: true,
          id: custom.id,
        };
      }
    }

    // Fallback to 'other' if custom category was deleted
    const fallback = findDefaultCategory(domain, 'other');
    return {
      name: fallback?.i18nKey || 'Other',
      icon: fallback?.icon || '📦',
      isCustom: false,
      key: 'other',
    };
  }

  // Default category
  const defaultCat = findDefaultCategory(domain, categoryValue);
  if (defaultCat) {
    return {
      name: defaultCat.i18nKey,
      icon: defaultCat.icon,
      isCustom: false,
      key: defaultCat.key,
    };
  }

  // Unknown category, return as-is with fallback icon
  return {
    name: categoryValue,
    icon: '📦',
    isCustom: false,
    key: categoryValue,
  };
}

/**
 * Get the list of valid domains
 * @returns {Array<string>} Valid domain names
 */
export function getValidDomains() {
  return [...VALID_DOMAINS];
}

/**
 * Get the maximum categories per user limit
 * @returns {number} Maximum categories allowed
 */
export function getMaxCategoriesLimit() {
  return MAX_CATEGORIES_PER_USER;
}

export default {
  getCategories,
  getCategoriesByDomain,
  getTripCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getUsageCount,
  resolveCategory,
  getValidDomains,
  getMaxCategoriesLimit,
};
