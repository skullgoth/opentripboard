// User preferences database queries

import { query } from '../connection.js';

/**
 * Default preferences for new users
 */
export const DEFAULT_PREFERENCES = {
  language: 'en',
  dateFormat: 'mdy',
  timeFormat: '12h',
  distanceFormat: 'mi',
};

/**
 * Supported languages with display names
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

/**
 * Get user preferences by user ID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} User preferences object with isDefault flag
 */
export async function getUserPreferences(userId) {
  const result = await query(
    'SELECT preferences FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const savedPrefs = result.rows[0].preferences;
  const hasExplicitPreferences = savedPrefs !== null && typeof savedPrefs === 'object' && Object.keys(savedPrefs).length > 0;

  // Merge with defaults to ensure all keys exist
  return {
    ...DEFAULT_PREFERENCES,
    ...(savedPrefs || {}),
    isDefault: !hasExplicitPreferences,
  };
}

/**
 * Update user preferences
 * @param {string} userId - User UUID
 * @param {Object} preferences - Preferences to update (partial or full)
 * @returns {Promise<Object>} Updated preferences object
 */
export async function updateUserPreferences(userId, preferences) {
  // Get current preferences first
  const current = await getUserPreferences(userId);
  if (!current) {
    throw new Error('User not found');
  }

  // Remove internal flags before merging
  const { isDefault, ...currentPrefs } = current;
  const { isDefault: _, ...newPrefs } = preferences;

  // Merge with current preferences
  const updated = { ...currentPrefs, ...newPrefs };

  const result = await query(
    `UPDATE users
     SET preferences = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING preferences`,
    [userId, JSON.stringify(updated)]
  );

  return result.rows[0].preferences;
}

/**
 * Get default preferences based on locale
 * @param {string} locale - Browser locale (e.g., 'en-US', 'fr-FR')
 * @returns {Object} Default preferences for the locale
 */
export function getDefaultsForLocale(locale) {
  if (!locale) {
    return { ...DEFAULT_PREFERENCES };
  }

  const lang = locale.split('-')[0].toLowerCase();
  const region = locale.split('-')[1]?.toUpperCase();

  // Determine language
  const supportedLangs = SUPPORTED_LANGUAGES.map((l) => l.code);
  const language = supportedLangs.includes(lang) ? lang : 'en';

  // Determine date format based on region/language
  // US uses mdy, most other countries use dmy
  const useMdy = region === 'US' || (lang === 'en' && !region);
  const dateFormat = useMdy ? 'mdy' : 'dmy';

  // Determine time format
  // US, UK, Australia typically use 12h; most of Europe uses 24h
  const use12h = ['US', 'GB', 'AU', 'CA'].includes(region) || lang === 'en';
  const timeFormat = use12h ? '12h' : '24h';

  // Determine distance format
  // US, UK use miles; most other countries use km
  const useMiles = ['US', 'GB'].includes(region);
  const distanceFormat = useMiles ? 'mi' : 'km';

  return {
    language,
    dateFormat,
    timeFormat,
    distanceFormat,
  };
}

/**
 * Validate preference values
 * @param {Object} preferences - Preferences to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validatePreferences(preferences) {
  const errors = [];

  if (preferences.language !== undefined) {
    const validLangs = SUPPORTED_LANGUAGES.map((l) => l.code);
    if (!validLangs.includes(preferences.language)) {
      errors.push(
        `Invalid language: ${preferences.language}. Valid values: ${validLangs.join(', ')}`
      );
    }
  }

  if (preferences.dateFormat !== undefined) {
    if (!['mdy', 'dmy'].includes(preferences.dateFormat)) {
      errors.push(
        `Invalid dateFormat: ${preferences.dateFormat}. Valid values: mdy, dmy`
      );
    }
  }

  if (preferences.timeFormat !== undefined) {
    if (!['12h', '24h'].includes(preferences.timeFormat)) {
      errors.push(
        `Invalid timeFormat: ${preferences.timeFormat}. Valid values: 12h, 24h`
      );
    }
  }

  if (preferences.distanceFormat !== undefined) {
    if (!['mi', 'km'].includes(preferences.distanceFormat)) {
      errors.push(
        `Invalid distanceFormat: ${preferences.distanceFormat}. Valid values: mi, km`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
