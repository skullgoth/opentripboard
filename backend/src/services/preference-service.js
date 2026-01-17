// Preference service - business logic for user preferences

import {
  getUserPreferences,
  updateUserPreferences,
  getDefaultsForLocale,
  validatePreferences,
  SUPPORTED_LANGUAGES,
  DEFAULT_PREFERENCES,
} from '../db/queries/preferences.js';

/**
 * Get preferences for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} User preferences
 */
export async function getPreferences(userId) {
  const preferences = await getUserPreferences(userId);
  if (!preferences) {
    // Return defaults if user not found or preferences not set
    return { ...DEFAULT_PREFERENCES };
  }
  return preferences;
}

/**
 * Update preferences for a user
 * @param {string} userId - User UUID
 * @param {Object} updates - Preference updates
 * @returns {Promise<Object>} Updated preferences
 */
export async function updatePreferences(userId, updates) {
  // Validate the updates
  const validation = validatePreferences(updates);
  if (!validation.valid) {
    const error = new Error(validation.errors.join('; '));
    error.statusCode = 400;
    throw error;
  }

  // Update in database
  const updated = await updateUserPreferences(userId, updates);
  return updated;
}

/**
 * Get list of supported languages
 * @returns {Array} Supported languages with codes and names
 */
export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

/**
 * Get default preferences based on browser locale
 * @param {string} locale - Browser locale (e.g., 'en-US', 'fr-FR')
 * @returns {Object} Default preferences for the locale
 */
export function getDefaults(locale) {
  return getDefaultsForLocale(locale);
}

/**
 * Validate preference updates
 * @param {Object} preferences - Preferences to validate
 * @returns {Object} Validation result
 */
export function validate(preferences) {
  return validatePreferences(preferences);
}

export default {
  getPreferences,
  updatePreferences,
  getSupportedLanguages,
  getDefaults,
  validate,
  DEFAULT_PREFERENCES,
};
