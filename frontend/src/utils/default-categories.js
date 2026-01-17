// Default category constants for activities, reservations, expenses, and documents
// These are system defaults that users cannot modify

import { t } from './i18n.js';

/**
 * Default activity types
 */
export const DEFAULT_ACTIVITY_TYPES = [
  // Culture & History
  { key: 'museum', icon: '🏛️', i18nKey: 'categories.activity.museum' },
  { key: 'monument', icon: '🗽', i18nKey: 'categories.activity.monument' },
  { key: 'historicSite', icon: '🏰', i18nKey: 'categories.activity.historicSite' },
  { key: 'temple', icon: '⛩️', i18nKey: 'categories.activity.temple' },
  { key: 'church', icon: '⛪', i18nKey: 'categories.activity.church' },
  // Nature & Outdoors
  { key: 'park', icon: '🌳', i18nKey: 'categories.activity.park' },
  { key: 'beach', icon: '🏖️', i18nKey: 'categories.activity.beach' },
  { key: 'garden', icon: '🌷', i18nKey: 'categories.activity.garden' },
  { key: 'hiking', icon: '🥾', i18nKey: 'categories.activity.hiking' },
  { key: 'viewpoint', icon: '🏔️', i18nKey: 'categories.activity.viewpoint' },
  // Entertainment
  { key: 'themePark', icon: '🎢', i18nKey: 'categories.activity.themePark' },
  { key: 'zoo', icon: '🦁', i18nKey: 'categories.activity.zoo' },
  { key: 'aquarium', icon: '🐠', i18nKey: 'categories.activity.aquarium' },
  { key: 'show', icon: '🎭', i18nKey: 'categories.activity.show' },
  { key: 'nightlife', icon: '🎉', i18nKey: 'categories.activity.nightlife' },
  // Food & Drink
  { key: 'restaurant', icon: '🍽️', i18nKey: 'categories.activity.restaurant' },
  { key: 'cafe', icon: '☕', i18nKey: 'categories.activity.cafe' },
  { key: 'market', icon: '🛒', i18nKey: 'categories.activity.market' },
  { key: 'winery', icon: '🍷', i18nKey: 'categories.activity.winery' },
  // Shopping & Leisure
  { key: 'shopping', icon: '🛍️', i18nKey: 'categories.activity.shopping' },
  { key: 'spa', icon: '💆', i18nKey: 'categories.activity.spa' },
  // Tours & Activities
  { key: 'tour', icon: '🚶', i18nKey: 'categories.activity.tour' },
  { key: 'sightseeing', icon: '📸', i18nKey: 'categories.activity.sightseeing' },
  { key: 'sports', icon: '⚽', i18nKey: 'categories.activity.sports' },
  { key: 'watersports', icon: '🏄', i18nKey: 'categories.activity.watersports' },
  // Other
  { key: 'other', icon: '📍', i18nKey: 'categories.activity.other' },
];

/**
 * Default reservation types with grouping
 */
export const DEFAULT_RESERVATION_TYPES = [
  // Lodging
  { key: 'hotel', icon: '🏨', group: 'lodging', i18nKey: 'categories.reservation.hotel' },
  { key: 'rental', icon: '🏠', group: 'lodging', i18nKey: 'categories.reservation.rental' },
  { key: 'hostel', icon: '🛏️', group: 'lodging', i18nKey: 'categories.reservation.hostel' },
  { key: 'camping', icon: '⛺', group: 'lodging', i18nKey: 'categories.reservation.camping' },
  { key: 'resort', icon: '🏝️', group: 'lodging', i18nKey: 'categories.reservation.resort' },
  // Transport
  { key: 'flight', icon: '✈️', group: 'transport', i18nKey: 'categories.reservation.flight' },
  { key: 'train', icon: '🚆', group: 'transport', i18nKey: 'categories.reservation.train' },
  { key: 'bus', icon: '🚌', group: 'transport', i18nKey: 'categories.reservation.bus' },
  { key: 'car', icon: '🚗', group: 'transport', i18nKey: 'categories.reservation.car' },
  { key: 'ferry', icon: '⛴️', group: 'transport', i18nKey: 'categories.reservation.ferry' },
  { key: 'cruise', icon: '🚢', group: 'transport', i18nKey: 'categories.reservation.cruise' },
  { key: 'taxi', icon: '🚕', group: 'transport', i18nKey: 'categories.reservation.taxi' },
  { key: 'transfer', icon: '🚐', group: 'transport', i18nKey: 'categories.reservation.transfer' },
  // Dining
  { key: 'restaurant', icon: '🍽️', group: 'dining', i18nKey: 'categories.reservation.restaurant' },
  { key: 'bar', icon: '🍸', group: 'dining', i18nKey: 'categories.reservation.bar' },
  { key: 'cafe', icon: '☕', group: 'dining', i18nKey: 'categories.reservation.cafe' },
  // Activities & Entertainment
  { key: 'tour', icon: '🚶', group: 'activities', i18nKey: 'categories.reservation.tour' },
  { key: 'attraction', icon: '🎢', group: 'activities', i18nKey: 'categories.reservation.attraction' },
  { key: 'show', icon: '🎭', group: 'activities', i18nKey: 'categories.reservation.show' },
  { key: 'museum', icon: '🏛️', group: 'activities', i18nKey: 'categories.reservation.museum' },
  { key: 'concert', icon: '🎵', group: 'activities', i18nKey: 'categories.reservation.concert' },
  { key: 'sports', icon: '🎟️', group: 'activities', i18nKey: 'categories.reservation.sports' },
  { key: 'spa', icon: '💆', group: 'activities', i18nKey: 'categories.reservation.spa' },
  { key: 'class', icon: '📚', group: 'activities', i18nKey: 'categories.reservation.class' },
  // Other
  { key: 'other', icon: '📋', group: 'other', i18nKey: 'categories.reservation.other' },
];

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
 * Valid domain values
 */
export const VALID_DOMAINS = ['activity', 'reservation', 'expense', 'document'];

/**
 * Maximum custom categories per user
 */
export const MAX_CATEGORIES_PER_USER = 100;

/**
 * Get all default categories organized by domain with translated names
 * @returns {Object} Default categories by domain
 */
export function getDefaultCategories() {
  return {
    activity: DEFAULT_ACTIVITY_TYPES.map(cat => ({
      id: cat.key,
      name: t(cat.i18nKey) || cat.key,
      icon: cat.icon,
      domain: 'activity',
      isCustom: false,
      i18nKey: cat.i18nKey,
    })),
    reservation: DEFAULT_RESERVATION_TYPES.map(cat => ({
      id: cat.key,
      name: t(cat.i18nKey) || cat.key,
      icon: cat.icon,
      domain: 'reservation',
      isCustom: false,
      group: cat.group,
      i18nKey: cat.i18nKey,
    })),
    expense: DEFAULT_EXPENSE_CATEGORIES.map(cat => ({
      id: cat.key,
      name: t(cat.i18nKey) || cat.key,
      icon: cat.icon,
      domain: 'expense',
      isCustom: false,
      i18nKey: cat.i18nKey,
    })),
    document: DEFAULT_DOCUMENT_TYPES.map(cat => ({
      id: cat.key,
      name: t(cat.i18nKey) || cat.key,
      icon: cat.icon,
      domain: 'document',
      isCustom: false,
      i18nKey: cat.i18nKey,
    })),
  };
}

/**
 * Get default categories for a specific domain
 * @param {string} domain - Category domain
 * @returns {Array} Default categories for the domain
 */
export function getDefaultCategoriesForDomain(domain) {
  const defaults = getDefaultCategories();
  return defaults[domain] || [];
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
 * Find a default category by domain and key
 * @param {string} domain - Category domain
 * @param {string} key - Category key
 * @returns {Object|null} The category or null
 */
export function findDefaultCategory(domain, key) {
  const defaults = getDefaultCategories();
  const domainCategories = defaults[domain];
  if (!domainCategories) return null;
  return domainCategories.find(cat => cat.id === key) || null;
}

/**
 * Get icon for a category by domain and key
 * @param {string} domain - Category domain
 * @param {string} key - Category key
 * @returns {string} Icon emoji or default
 */
export function getCategoryIcon(domain, key) {
  const category = findDefaultCategory(domain, key);
  return category ? category.icon : '📁';
}

/**
 * Curated set of travel-related emoji icons for the icon picker
 */
export const ICON_PICKER_EMOJIS = [
  // Travel & Transport
  '✈️', '🚗', '🚌', '🚆', '🚢', '⛴️', '🚁', '🚕', '🚲', '🛵',
  // Accommodation
  '🏨', '🏠', '🏡', '⛺', '🛏️', '🏕️',
  // Food & Dining
  '🍽️', '🍴', '🍸', '🍺', '☕', '🍕', '🍜', '🍣', '🥗', '🧁',
  // Activities
  '🎭', '🎪', '🎢', '🎡', '🎠', '🏛️', '🗽', '🎨', '📸', '🎬',
  // Nature & Outdoors
  '🌳', '🏔️', '🏖️', '🌊', '🌅', '🌄', '⛰️', '🏜️', '🌴', '🌸',
  // Shopping & Commerce
  '🛒', '🛍️', '💳', '💰', '🏪', '🏬',
  // Documents & Admin
  '📄', '📋', '🪪', '🎫', '🎟️', '📦', '🛡️', '🗺️', '📷', '📱',
  // Sports & Recreation
  '⚽', '🏀', '🎾', '🏊', '🎣', '🏄', '⛷️', '🚴', '🧗', '🏌️',
  // Events & Entertainment
  '🎉', '🎊', '🎵', '🎤', '🎧', '🎮', '🎯', '🎲', '🃏', '🎰',
  // Health & Wellness
  '💊', '🏥', '💉', '🩺', '🧘', '💆', '🛀', '🧴',
  // Communication
  '📞', '📧', '💬', '📝', '✉️', '📬',
  // Miscellaneous
  '⭐', '❤️', '🔥', '✨', '💡', '🔑', '🎁', '🏆', '🎖️', '📌',
];
