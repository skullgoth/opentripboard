// Category resolution utility
// Resolves category values (default keys or custom:uuid refs) to display info

import { findDefaultCategory, isCustomCategory, extractCustomCategoryId } from './default-categories.js';
import { findCategoryByValue as findFromState } from '../state/categories-state.js';
import { t } from './i18n.js';

/**
 * @typedef {Object} ResolvedCategory
 * @property {string} name - Display name (localized for defaults)
 * @property {string} icon - Emoji icon
 * @property {boolean} isCustom - True if custom category
 * @property {string} key - Category key (for defaults)
 * @property {string} id - Category UUID (for custom)
 */

/**
 * Resolve a category value to display information
 * Uses state for custom categories, falls back to defaults for unknown
 *
 * @param {string} value - Category value (key for defaults, 'custom:uuid' for custom)
 * @param {string} domain - Category domain (activity, expense, document)
 * @param {Array} [customCategories] - Optional custom categories array (for optimization)
 * @returns {ResolvedCategory} Resolved category with name and icon
 */
export function resolveCategory(value, domain, customCategories = null) {
  // Handle null/undefined
  if (!value) {
    return getFallbackCategory(domain);
  }

  // Check if it's a custom category
  if (isCustomCategory(value)) {
    const categoryId = extractCustomCategoryId(value);

    // First try provided custom categories
    if (customCategories) {
      const custom = customCategories.find((c) => c.id === categoryId);
      if (custom) {
        return {
          name: custom.name,
          icon: custom.icon,
          isCustom: true,
          id: custom.id,
        };
      }
    }

    // Try from state
    const fromState = findFromState(value, domain);
    if (fromState) {
      return {
        name: fromState.name,
        icon: fromState.icon,
        isCustom: true,
        id: fromState.id,
      };
    }

    // Custom category not found (probably deleted), return fallback
    return getFallbackCategory(domain);
  }

  // Default category - lookup by key
  const defaultCat = findDefaultCategory(domain, value);
  if (defaultCat) {
    return {
      name: t(defaultCat.i18nKey) || defaultCat.key,
      icon: defaultCat.icon,
      isCustom: false,
      key: defaultCat.key,
    };
  }

  // Unknown category key, return as-is with fallback icon
  return {
    name: value,
    icon: getDefaultIconForDomain(domain),
    isCustom: false,
    key: value,
  };
}

/**
 * Get the fallback category for a domain (used when category not found)
 * @param {string} domain - Category domain
 * @returns {ResolvedCategory} Fallback 'other' category
 */
export function getFallbackCategory(domain) {
  const otherCat = findDefaultCategory(domain, 'other');
  if (otherCat) {
    return {
      name: t(otherCat.i18nKey) || 'Other',
      icon: otherCat.icon,
      isCustom: false,
      key: 'other',
    };
  }

  // Ultimate fallback
  return {
    name: t('categories.expense.other') || 'Other',
    icon: getDefaultIconForDomain(domain),
    isCustom: false,
    key: 'other',
  };
}

/**
 * Get a default icon for a domain
 * @param {string} domain - Category domain
 * @returns {string} Default emoji icon
 */
export function getDefaultIconForDomain(domain) {
  const icons = {
    activity: '📍',
    expense: '💰',
    document: '📄',
  };
  return icons[domain] || '📦';
}

/**
 * Format a category for display (icon + name)
 * @param {string} value - Category value
 * @param {string} domain - Category domain
 * @param {Array} [customCategories] - Optional custom categories
 * @returns {string} Formatted display string
 */
export function formatCategory(value, domain, customCategories = null) {
  const resolved = resolveCategory(value, domain, customCategories);
  return `${resolved.icon} ${resolved.name}`;
}

/**
 * Get category icon only
 * @param {string} value - Category value
 * @param {string} domain - Category domain
 * @param {Array} [customCategories] - Optional custom categories
 * @returns {string} Category icon
 */
export function getCategoryIcon(value, domain, customCategories = null) {
  const resolved = resolveCategory(value, domain, customCategories);
  return resolved.icon;
}

/**
 * Get category name only
 * @param {string} value - Category value
 * @param {string} domain - Category domain
 * @param {Array} [customCategories] - Optional custom categories
 * @returns {string} Category name
 */
export function getCategoryName(value, domain, customCategories = null) {
  const resolved = resolveCategory(value, domain, customCategories);
  return resolved.name;
}

/**
 * Build options array for a category select dropdown
 * @param {string} domain - Category domain
 * @param {Array} defaultCategories - Default categories for domain
 * @param {Array} customCategories - Custom categories for domain
 * @returns {Array} Options array with optgroup structure
 */
export function buildCategoryOptions(domain, defaultCategories, customCategories = []) {
  const options = [];

  // Add default categories
  if (defaultCategories && defaultCategories.length > 0) {
    const defaultOptions = defaultCategories.map((cat) => ({
      value: cat.id || cat.key, // Support both id (from state) and key (legacy)
      label: t(cat.i18nKey) || cat.name || cat.id || cat.key,
      icon: cat.icon,
      isCustom: false,
      group: cat.group || null,
    }));

    // Group by 'group' property if present (for activities)
    const grouped = {};
    const ungrouped = [];

    for (const opt of defaultOptions) {
      if (opt.group) {
        if (!grouped[opt.group]) {
          grouped[opt.group] = [];
        }
        grouped[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    }

    // Add ungrouped defaults first
    options.push(...ungrouped);

    // Add grouped defaults
    for (const [groupName, groupOptions] of Object.entries(grouped)) {
      options.push({
        groupLabel: t(`categories.groups.${groupName}`) || groupName,
        options: groupOptions,
      });
    }
  }

  // Add custom categories section
  if (customCategories && customCategories.length > 0) {
    const customOptions = customCategories.map((cat) => ({
      value: cat.ref || `custom:${cat.id}`,
      label: cat.name,
      icon: cat.icon,
      isCustom: true,
    }));

    options.push({
      groupLabel: t('categories.custom') || 'Custom',
      options: customOptions,
    });
  }

  return options;
}

export default {
  resolveCategory,
  getFallbackCategory,
  getDefaultIconForDomain,
  formatCategory,
  getCategoryIcon,
  getCategoryName,
  buildCategoryOptions,
};
