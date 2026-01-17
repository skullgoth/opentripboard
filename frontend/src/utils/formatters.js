// Unified formatters for dates, times, and distances
// Uses Intl API for locale-aware formatting based on user preferences

import { getPreferences } from '../state/preferences-state.js';

/**
 * Get locale based on language and date format preferences
 * @param {Object} preferences - User preferences
 * @returns {string} Locale string for Intl API
 */
function getLocale(preferences) {
  const language = preferences.language || 'en';
  const dateFormat = preferences.dateFormat || 'mdy';

  const languageMap = {
    en: dateFormat === 'dmy' ? 'en-GB' : 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
  };
  return languageMap[language] || languageMap.en;
}

/**
 * Format a date according to user preferences
 * @param {Date|string|number} date - Date to format
 * @param {Object} [prefs] - Preferences (optional, uses current state if not provided)
 * @returns {string} Formatted date string
 */
export function formatDate(date, prefs = null) {
  const preferences = prefs || getPreferences();
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getLocale(preferences);

  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a date with year according to user preferences
 * @param {Date|string|number} date - Date to format
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted date string with year
 */
export function formatDateWithYear(date, prefs = null) {
  const preferences = prefs || getPreferences();
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getLocale(preferences);

  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a date in long format (e.g., "March 21, 2025" or "21 March 2025")
 * @param {Date|string|number} date - Date to format
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted date string
 */
export function formatDateLong(date, prefs = null) {
  const preferences = prefs || getPreferences();
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getLocale(preferences);

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a time according to user preferences
 * @param {Date|string|number} date - Date/time to format
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted time string
 */
export function formatTime(date, prefs = null) {
  const preferences = prefs || getPreferences();
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Time';
  }

  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: preferences.timeFormat === '12h',
  }).format(d);
}

/**
 * Format a date and time according to user preferences
 * @param {Date|string|number} date - Date/time to format
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, prefs = null) {
  const preferences = prefs || getPreferences();
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getLocale(preferences);

  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: preferences.timeFormat === '12h',
  }).format(d);
}

/**
 * Format a distance according to user preferences
 * @param {number} distanceKm - Distance in kilometers
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted distance string with unit
 */
export function formatDistance(distanceKm, prefs = null) {
  const preferences = prefs || getPreferences();

  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) {
    return 'Invalid Distance';
  }

  if (preferences.distanceFormat === 'mi') {
    // Convert km to miles
    const miles = distanceKm * 0.621371;
    return `${miles.toFixed(1)} mi`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format a distance with more precision
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} [decimals=2] - Number of decimal places
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Formatted distance string with unit
 */
export function formatDistancePrecise(distanceKm, decimals = 2, prefs = null) {
  const preferences = prefs || getPreferences();

  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) {
    return 'Invalid Distance';
  }

  if (preferences.distanceFormat === 'mi') {
    const miles = distanceKm * 0.621371;
    return `${miles.toFixed(decimals)} mi`;
  }

  return `${distanceKm.toFixed(decimals)} km`;
}

/**
 * Get the distance unit label based on preferences
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {string} Unit label ('km' or 'mi')
 */
export function getDistanceUnit(prefs = null) {
  const preferences = prefs || getPreferences();
  return preferences.distanceFormat === 'mi' ? 'mi' : 'km';
}

/**
 * Convert distance to user's preferred unit (returns raw number)
 * @param {number} distanceKm - Distance in kilometers
 * @param {Object} [prefs] - Preferences (optional)
 * @returns {number} Distance in user's preferred unit
 */
export function convertDistance(distanceKm, prefs = null) {
  const preferences = prefs || getPreferences();

  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) {
    return 0;
  }

  if (preferences.distanceFormat === 'mi') {
    return distanceKm * 0.621371;
  }

  return distanceKm;
}

/**
 * Get example formatted values for displaying preference previews
 * @param {Object} prefs - Preferences object
 * @returns {Object} Object with example formatted values
 */
export function getFormatExamples(prefs) {
  const exampleDate = new Date(2025, 2, 21, 14, 30); // March 21, 2025, 2:30 PM

  return {
    date: formatDate(exampleDate, prefs),
    dateWithYear: formatDateWithYear(exampleDate, prefs),
    time: formatTime(exampleDate, prefs),
    distance: formatDistance(80, prefs), // 80 km example
  };
}
