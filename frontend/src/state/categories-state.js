// Categories state management

import { getDefaultCategories } from '../utils/default-categories.js';
import { onLanguageChange, isI18nLoaded } from '../utils/i18n.js';

/**
 * @typedef {Object} Category
 * @property {string} id - Category UUID (custom only)
 * @property {string} key - Category key (defaults only)
 * @property {string} name - Display name
 * @property {string} icon - Emoji icon
 * @property {boolean} isCustom - True if custom category
 * @property {string} ref - Reference string for storage (custom only)
 * @property {string} i18nKey - Localization key (defaults only)
 */

/**
 * @typedef {Object} CategoriesState
 * @property {Object} defaults - Default categories by domain
 * @property {Object} custom - Custom categories by domain
 */

/**
 * State container for categories
 * Note: defaults are initialized to null and populated after i18n is ready
 */
const state = {
  /** @type {Object} Default categories by domain */
  defaults: null,
  /** @type {boolean} Flag to track if defaults have been loaded with translations */
  defaultsTranslated: false,
  /** @type {Object} Custom categories by domain (reservation merged into activity) */
  custom: {
    activity: [],
    expense: [],
    document: [],
  },
  /** @type {boolean} */
  isLoaded: false,
  /** @type {boolean} */
  isLoading: false,
  /** @type {Set<Function>} */
  subscribers: new Set(),
  /** @type {Map<string, Object>} Trip-specific categories cache */
  tripCategoriesCache: new Map(),
};

/**
 * Ensure defaults are loaded (lazy initialization)
 * Called internally before accessing defaults
 */
function ensureDefaultsLoaded() {
  // Always register language listener on first call
  registerLanguageListener();

  if (state.defaults === null) {
    state.defaults = getDefaultCategories();
  } else if (isI18nLoaded() && !state.defaultsTranslated) {
    // Refresh defaults once i18n is ready to get translated names
    state.defaults = getDefaultCategories();
    state.defaultsTranslated = true;
  }
}

/**
 * Refresh default categories (called when language changes)
 * This ensures translated names are up-to-date
 */
export function refreshDefaultCategories() {
  state.defaults = getDefaultCategories();
  notifySubscribers();
}

// Flag to track if language change listener is registered
let languageListenerRegistered = false;

/**
 * Register for language changes to update translated category names
 * Called lazily to avoid initialization order issues
 */
function registerLanguageListener() {
  if (languageListenerRegistered) return;
  languageListenerRegistered = true;
  onLanguageChange(() => {
    refreshDefaultCategories();
  });
}

/**
 * Get all categories (defaults + custom)
 * @returns {Object} Categories object with defaults and custom by domain
 */
export function getCategories() {
  ensureDefaultsLoaded();
  return {
    defaults: { ...state.defaults },
    custom: { ...state.custom },
  };
}

/**
 * Get categories for a specific domain
 * @param {string} domain - Category domain (activity, expense, document)
 * @returns {Object} Categories for the domain { defaults: [], custom: [] }
 */
export function getCategoriesByDomain(domain) {
  ensureDefaultsLoaded();
  return {
    defaults: state.defaults[domain] || [],
    custom: state.custom[domain] || [],
  };
}

/**
 * Get all categories for a domain as a flat array (defaults first, then custom)
 * @param {string} domain - Category domain
 * @returns {Array} Array of all categories for the domain
 */
export function getAllCategoriesForDomain(domain) {
  ensureDefaultsLoaded();
  const defaults = (state.defaults[domain] || []).map((cat) => ({
    ...cat,
    isCustom: false,
    value: cat.key,
  }));
  const custom = (state.custom[domain] || []).map((cat) => ({
    ...cat,
    isCustom: true,
    value: cat.ref,
  }));
  return [...defaults, ...custom];
}

/**
 * Get custom categories only
 * @returns {Object} Custom categories by domain
 */
export function getCustomCategories() {
  return { ...state.custom };
}

/**
 * Get custom categories count
 * @returns {number} Total count of custom categories
 */
export function getCustomCategoriesCount() {
  return Object.values(state.custom).reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Set categories state (from API response)
 * @param {Object} categories - Categories object { defaults, custom }
 */
export function setCategories(categories) {
  const oldState = { defaults: state.defaults, custom: state.custom };

  if (categories.defaults) {
    state.defaults = categories.defaults;
  }
  if (categories.custom) {
    state.custom = categories.custom;
  }

  state.isLoaded = true;
  notifySubscribers({ defaults: state.defaults, custom: state.custom }, oldState);
}

/**
 * Add a custom category to state
 * @param {Object} category - Category object with domain
 */
export function addCustomCategory(category) {
  const oldState = { defaults: state.defaults, custom: state.custom };
  const domain = category.domain;

  if (!state.custom[domain]) {
    state.custom[domain] = [];
  }

  state.custom[domain] = [...state.custom[domain], category];
  notifySubscribers({ defaults: state.defaults, custom: state.custom }, oldState);
}

/**
 * Update a custom category in state
 * @param {string} categoryId - Category UUID
 * @param {Object} updates - Updated fields
 */
export function updateCustomCategory(categoryId, updates) {
  const oldState = { defaults: state.defaults, custom: state.custom };

  for (const domain of Object.keys(state.custom)) {
    const index = state.custom[domain].findIndex((c) => c.id === categoryId);
    if (index !== -1) {
      state.custom[domain] = [
        ...state.custom[domain].slice(0, index),
        { ...state.custom[domain][index], ...updates },
        ...state.custom[domain].slice(index + 1),
      ];
      break;
    }
  }

  notifySubscribers({ defaults: state.defaults, custom: state.custom }, oldState);
}

/**
 * Remove a custom category from state
 * @param {string} categoryId - Category UUID
 */
export function removeCustomCategory(categoryId) {
  const oldState = { defaults: state.defaults, custom: state.custom };

  for (const domain of Object.keys(state.custom)) {
    const index = state.custom[domain].findIndex((c) => c.id === categoryId);
    if (index !== -1) {
      state.custom[domain] = [
        ...state.custom[domain].slice(0, index),
        ...state.custom[domain].slice(index + 1),
      ];
      break;
    }
  }

  notifySubscribers({ defaults: state.defaults, custom: state.custom }, oldState);
}

/**
 * Find a category by its value (key for defaults, ref for custom)
 * @param {string} value - Category value
 * @param {string} domain - Category domain
 * @returns {Object|null} Category object or null
 */
export function findCategoryByValue(value, domain) {
  // Check if it's a custom category
  if (value && value.startsWith('custom:')) {
    const categoryId = value.substring(7);
    const customCats = state.custom[domain] || [];
    return customCats.find((c) => c.id === categoryId) || null;
  }

  // Check defaults
  const defaultCats = state.defaults[domain] || [];
  return defaultCats.find((c) => c.key === value) || null;
}

/**
 * Check if categories are loaded
 * @returns {boolean} True if categories have been loaded
 */
export function isCategoriesLoaded() {
  return state.isLoaded;
}

/**
 * Check if categories are currently loading
 * @returns {boolean} True if categories are being loaded
 */
export function isCategoriesLoading() {
  return state.isLoading;
}

/**
 * Set loading state
 * @param {boolean} loading - Loading state
 */
export function setCategoriesLoading(loading) {
  state.isLoading = loading;
}

/**
 * Subscribe to category changes
 * @param {Function} callback - Callback function (newState, oldState) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeToCategories(callback) {
  state.subscribers.add(callback);
  return () => state.subscribers.delete(callback);
}

/**
 * Notify all subscribers of category changes
 * @param {Object} newState - New state
 * @param {Object} oldState - Previous state
 */
function notifySubscribers(newState, oldState) {
  state.subscribers.forEach((callback) => {
    try {
      callback(newState, oldState);
    } catch (error) {
      console.error('[CategoriesState] Subscriber error:', error);
    }
  });
}

/**
 * Reset categories to defaults
 */
export function resetCategories() {
  const oldState = { defaults: state.defaults, custom: state.custom };

  state.defaults = getDefaultCategories();
  state.custom = {
    activity: [],
    expense: [],
    document: [],
  };
  state.isLoaded = false;
  state.tripCategoriesCache.clear();

  notifySubscribers({ defaults: state.defaults, custom: state.custom }, oldState);
}

/**
 * Get cached trip categories
 * @param {string} tripId - Trip UUID
 * @returns {Object|null} Cached categories or null
 */
export function getTripCategoriesFromCache(tripId) {
  return state.tripCategoriesCache.get(tripId) || null;
}

/**
 * Cache trip categories
 * @param {string} tripId - Trip UUID
 * @param {Object} categories - Categories to cache
 */
export function cacheTripCategories(tripId, categories) {
  state.tripCategoriesCache.set(tripId, categories);
}

/**
 * Clear trip categories cache
 * @param {string} tripId - Optional trip ID to clear, or all if not provided
 */
export function clearTripCategoriesCache(tripId = null) {
  if (tripId) {
    state.tripCategoriesCache.delete(tripId);
  } else {
    state.tripCategoriesCache.clear();
  }
}

/**
 * Categories state module for external access
 */
export const categoriesState = {
  get: getCategories,
  getByDomain: getCategoriesByDomain,
  getAllForDomain: getAllCategoriesForDomain,
  getCustom: getCustomCategories,
  getCustomCount: getCustomCategoriesCount,
  set: setCategories,
  addCustom: addCustomCategory,
  updateCustom: updateCustomCategory,
  removeCustom: removeCustomCategory,
  findByValue: findCategoryByValue,
  isLoaded: isCategoriesLoaded,
  isLoading: isCategoriesLoading,
  setLoading: setCategoriesLoading,
  subscribe: subscribeToCategories,
  reset: resetCategories,
  getTripCache: getTripCategoriesFromCache,
  setTripCache: cacheTripCategories,
  clearTripCache: clearTripCategoriesCache,
};

export default categoriesState;
