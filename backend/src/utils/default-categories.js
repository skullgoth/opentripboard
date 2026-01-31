// Default category constants for activities, expenses, and documents
// These are system defaults that users cannot modify
//
// Unified Activity System:
// All travel-related types (formerly split between "activities" and "reservations")
// are now unified under a single "activity" domain with groups for organization.

/**
 * Activity groups for organizing types in UI
 */
export const ACTIVITY_GROUPS = [
  { key: 'culture', i18nKey: 'categories.groups.culture' },
  { key: 'nature', i18nKey: 'categories.groups.nature' },
  { key: 'entertainment', i18nKey: 'categories.groups.entertainment' },
  { key: 'food', i18nKey: 'categories.groups.food' },
  { key: 'shopping', i18nKey: 'categories.groups.shopping' },
  { key: 'tours', i18nKey: 'categories.groups.tours' },
  { key: 'lodging', i18nKey: 'categories.groups.lodging' },
  { key: 'transport', i18nKey: 'categories.groups.transport' },
  { key: 'dining', i18nKey: 'categories.groups.dining' },
  { key: 'other', i18nKey: 'categories.groups.other' },
];

/**
 * Types that have special form fields (former reservation types)
 */
export const TYPES_WITH_SPECIAL_FIELDS = [
  'hotel', 'rental', 'hostel', 'camping', 'resort',
  'flight', 'train', 'bus', 'car', 'ferry', 'cruise', 'taxi', 'transfer',
  'restaurant', 'bar', 'cafe',
];

/**
 * Lodging types (for multi-day detection)
 */
export const LODGING_TYPES = ['hotel', 'rental', 'hostel', 'camping', 'resort'];

/**
 * Default activity types - unified list including former reservation types
 */
export const DEFAULT_ACTIVITY_TYPES = [
  // Culture & History
  { key: 'museum', icon: '🏛️', i18nKey: 'categories.activity.museum', group: 'culture' },
  { key: 'monument', icon: '🗽', i18nKey: 'categories.activity.monument', group: 'culture' },
  { key: 'historicSite', icon: '🏰', i18nKey: 'categories.activity.historicSite', group: 'culture' },
  { key: 'temple', icon: '⛩️', i18nKey: 'categories.activity.temple', group: 'culture' },
  { key: 'church', icon: '⛪', i18nKey: 'categories.activity.church', group: 'culture' },

  // Nature & Outdoors
  { key: 'park', icon: '🌳', i18nKey: 'categories.activity.park', group: 'nature' },
  { key: 'beach', icon: '🏖️', i18nKey: 'categories.activity.beach', group: 'nature' },
  { key: 'garden', icon: '🌷', i18nKey: 'categories.activity.garden', group: 'nature' },
  { key: 'hiking', icon: '🥾', i18nKey: 'categories.activity.hiking', group: 'nature' },
  { key: 'viewpoint', icon: '🏔️', i18nKey: 'categories.activity.viewpoint', group: 'nature' },

  // Entertainment
  { key: 'themePark', icon: '🎢', i18nKey: 'categories.activity.themePark', group: 'entertainment' },
  { key: 'zoo', icon: '🦁', i18nKey: 'categories.activity.zoo', group: 'entertainment' },
  { key: 'aquarium', icon: '🐠', i18nKey: 'categories.activity.aquarium', group: 'entertainment' },
  { key: 'show', icon: '🎭', i18nKey: 'categories.activity.show', group: 'entertainment' },
  { key: 'concert', icon: '🎵', i18nKey: 'categories.activity.concert', group: 'entertainment' },
  { key: 'nightlife', icon: '🎉', i18nKey: 'categories.activity.nightlife', group: 'entertainment' },
  { key: 'sports', icon: '⚽', i18nKey: 'categories.activity.sports', group: 'entertainment' },

  // Food & Drink (simple activities - no reservation fields)
  { key: 'market', icon: '🛒', i18nKey: 'categories.activity.market', group: 'food' },
  { key: 'winery', icon: '🍷', i18nKey: 'categories.activity.winery', group: 'food' },

  // Shopping & Leisure
  { key: 'shopping', icon: '🛍️', i18nKey: 'categories.activity.shopping', group: 'shopping' },
  { key: 'spa', icon: '💆', i18nKey: 'categories.activity.spa', group: 'shopping' },

  // Tours & Activities
  { key: 'tour', icon: '🚶', i18nKey: 'categories.activity.tour', group: 'tours' },
  { key: 'sightseeing', icon: '📸', i18nKey: 'categories.activity.sightseeing', group: 'tours' },
  { key: 'watersports', icon: '🏄', i18nKey: 'categories.activity.watersports', group: 'tours' },
  { key: 'class', icon: '📚', i18nKey: 'categories.activity.class', group: 'tours' },
  { key: 'attraction', icon: '🎡', i18nKey: 'categories.activity.attraction', group: 'tours' },

  // Lodging (has special fields)
  { key: 'hotel', icon: '🏨', i18nKey: 'categories.activity.hotel', group: 'lodging', hasSpecialFields: true },
  { key: 'rental', icon: '🏠', i18nKey: 'categories.activity.rental', group: 'lodging', hasSpecialFields: true },
  { key: 'hostel', icon: '🛏️', i18nKey: 'categories.activity.hostel', group: 'lodging', hasSpecialFields: true },
  { key: 'camping', icon: '⛺', i18nKey: 'categories.activity.camping', group: 'lodging', hasSpecialFields: true },
  { key: 'resort', icon: '🏝️', i18nKey: 'categories.activity.resort', group: 'lodging', hasSpecialFields: true },

  // Transport (has special fields)
  { key: 'flight', icon: '✈️', i18nKey: 'categories.activity.flight', group: 'transport', hasSpecialFields: true },
  { key: 'train', icon: '🚆', i18nKey: 'categories.activity.train', group: 'transport', hasSpecialFields: true },
  { key: 'bus', icon: '🚌', i18nKey: 'categories.activity.bus', group: 'transport', hasSpecialFields: true },
  { key: 'car', icon: '🚗', i18nKey: 'categories.activity.car', group: 'transport', hasSpecialFields: true },
  { key: 'ferry', icon: '⛴️', i18nKey: 'categories.activity.ferry', group: 'transport', hasSpecialFields: true },
  { key: 'cruise', icon: '🚢', i18nKey: 'categories.activity.cruise', group: 'transport', hasSpecialFields: true },
  { key: 'taxi', icon: '🚕', i18nKey: 'categories.activity.taxi', group: 'transport', hasSpecialFields: true },
  { key: 'transfer', icon: '🚐', i18nKey: 'categories.activity.transfer', group: 'transport', hasSpecialFields: true },

  // Dining (has special fields for reservations)
  { key: 'restaurant', icon: '🍽️', i18nKey: 'categories.activity.restaurant', group: 'dining', hasSpecialFields: true },
  { key: 'bar', icon: '🍸', i18nKey: 'categories.activity.bar', group: 'dining', hasSpecialFields: true },
  { key: 'cafe', icon: '☕', i18nKey: 'categories.activity.cafe', group: 'dining', hasSpecialFields: true },

  // Other
  { key: 'other', icon: '📍', i18nKey: 'categories.activity.other', group: 'other' },
];

/**
 * Legacy: DEFAULT_RESERVATION_TYPES alias for backwards compatibility
 * @deprecated Use DEFAULT_ACTIVITY_TYPES with hasSpecialFields flag instead
 */
export const DEFAULT_RESERVATION_TYPES = DEFAULT_ACTIVITY_TYPES.filter(t => t.hasSpecialFields);

/**
 * Default expense categories
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { key: 'accommodation', icon: '🏨', i18nKey: 'categories.expense.accommodation' },
  { key: 'transportation', icon: '🚗', i18nKey: 'categories.expense.transportation' },
  { key: 'food', icon: '🍽️', i18nKey: 'categories.expense.food' },
  { key: 'activities', icon: '🎭', i18nKey: 'categories.expense.activities' },
  { key: 'shopping', icon: '🛍️', i18nKey: 'categories.expense.shopping' },
  { key: 'entertainment', icon: '🎬', i18nKey: 'categories.expense.entertainment' },
  { key: 'other', icon: '📦', i18nKey: 'categories.expense.other' },
];

/**
 * Default document types
 */
export const DEFAULT_DOCUMENT_TYPES = [
  { key: 'passport', icon: '🪪', i18nKey: 'categories.document.passport' },
  { key: 'visa', icon: '📋', i18nKey: 'categories.document.visa' },
  { key: 'ticket', icon: '🎫', i18nKey: 'categories.document.ticket' },
  { key: 'reservation', icon: '🏨', i18nKey: 'categories.document.reservation' },
  { key: 'insurance', icon: '🛡️', i18nKey: 'categories.document.insurance' },
  { key: 'itinerary', icon: '🗺️', i18nKey: 'categories.document.itinerary' },
  { key: 'photo', icon: '📷', i18nKey: 'categories.document.photo' },
  { key: 'other', icon: '📄', i18nKey: 'categories.document.other' },
];

/**
 * Valid domain values (reservation merged into activity)
 */
export const VALID_DOMAINS = ['activity', 'expense', 'document'];

/**
 * Maximum custom categories per user
 */
export const MAX_CATEGORIES_PER_USER = 100;

/**
 * Get all default categories organized by domain
 * @returns {Object} Default categories by domain
 */
export function getDefaultCategories() {
  return {
    activity: DEFAULT_ACTIVITY_TYPES.map(cat => ({
      id: cat.key,
      name: cat.key, // Will be resolved via i18n on frontend
      icon: cat.icon,
      domain: 'activity',
      isCustom: false,
      group: cat.group,
      hasSpecialFields: cat.hasSpecialFields || false,
      i18nKey: cat.i18nKey,
    })),
    expense: DEFAULT_EXPENSE_CATEGORIES.map(cat => ({
      id: cat.key,
      name: cat.key,
      icon: cat.icon,
      domain: 'expense',
      isCustom: false,
      i18nKey: cat.i18nKey,
    })),
    document: DEFAULT_DOCUMENT_TYPES.map(cat => ({
      id: cat.key,
      name: cat.key,
      icon: cat.icon,
      domain: 'document',
      isCustom: false,
      i18nKey: cat.i18nKey,
    })),
  };
}

/**
 * Check if a category value is a custom category reference
 * @param {string} value - Category value to check
 * @returns {boolean} True if custom category
 */
export function isCustomCategory(value) {
  return value && value.startsWith('custom:');
}

/**
 * Extract UUID from custom category reference
 * @param {string} value - Custom category value (e.g., 'custom:uuid')
 * @returns {string|null} UUID or null if not a custom category
 */
export function extractCustomCategoryId(value) {
  if (!isCustomCategory(value)) {
    return null;
  }
  return value.substring(7);
}

/**
 * Create a custom category reference
 * @param {string} uuid - Category UUID
 * @returns {string} Custom category reference
 */
export function createCustomCategoryRef(uuid) {
  return `custom:${uuid}`;
}

/**
 * Get the 'other' category for a domain (fallback)
 * @param {string} domain - Category domain
 * @returns {Object|null} The 'other' category or null
 */
export function getOtherCategory(domain) {
  const defaults = getDefaultCategories();
  const domainCategories = defaults[domain];
  if (!domainCategories) return null;
  return domainCategories.find(cat => cat.id === 'other') || domainCategories[domainCategories.length - 1];
}

/**
 * Get default categories for a specific domain
 * @param {string} domain - Category domain
 * @returns {Array} Default categories for the domain
 */
export function getDefaultCategoriesByDomain(domain) {
  const defaults = getDefaultCategories();
  return defaults[domain] || [];
}

/**
 * Find a default category by key within a domain
 * @param {string} domain - Category domain
 * @param {string} key - Category key to find
 * @returns {Object|null} The category or null if not found
 */
export function findDefaultCategory(domain, key) {
  const domainDefaults = getDefaultCategoriesByDomain(domain);
  return domainDefaults.find(cat => cat.id === key) || null;
}

/**
 * Check if a type has special form fields
 * @param {string} type - Activity type key
 * @returns {boolean} True if type has special fields
 */
export function hasSpecialFields(type) {
  return TYPES_WITH_SPECIAL_FIELDS.includes(type);
}

/**
 * Check if a type is a lodging type (can span multiple days)
 * @param {string} type - Activity type key
 * @returns {boolean} True if lodging type
 */
export function isLodgingType(type) {
  return LODGING_TYPES.includes(type);
}

/**
 * Get the group for a given type
 * @param {string} type - Activity type key
 * @returns {string|null} Group key or null
 */
export function getTypeGroup(type) {
  const activityType = DEFAULT_ACTIVITY_TYPES.find(t => t.key === type);
  return activityType?.group || null;
}
