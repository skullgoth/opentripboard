// User preferences state management

import { getDefaultPreferences } from '../utils/locale-detection.js';

/**
 * @typedef {Object} Preferences
 * @property {string} language - Language code (en, fr, es)
 * @property {string} dateFormat - Date format (mdy, dmy)
 * @property {string} timeFormat - Time format (12h, 24h)
 * @property {string} distanceFormat - Distance format (mi, km)
 */

/**
 * State container for user preferences
 */
const state = {
  /** @type {Preferences} */
  preferences: getDefaultPreferences(),
  /** @type {boolean} */
  isLoaded: false,
  /** @type {boolean} */
  isLoading: false,
  /** @type {Set<Function>} */
  subscribers: new Set(),
};

/**
 * Get current preferences
 * @returns {Preferences} Current preferences object
 */
export function getPreferences() {
  return { ...state.preferences };
}

/**
 * Set preferences (replaces current state)
 * @param {Preferences} preferences - New preferences
 */
export function setPreferences(preferences) {
  const oldPreferences = state.preferences;
  state.preferences = { ...preferences };
  state.isLoaded = true;
  notifySubscribers(state.preferences, oldPreferences);
}

/**
 * Update preferences (merges with current state)
 * @param {Partial<Preferences>} updates - Preference updates
 */
export function updatePreferences(updates) {
  const oldPreferences = state.preferences;
  state.preferences = { ...state.preferences, ...updates };
  notifySubscribers(state.preferences, oldPreferences);
}

/**
 * Check if preferences are loaded
 * @returns {boolean} True if preferences have been loaded
 */
export function isPreferencesLoaded() {
  return state.isLoaded;
}

/**
 * Check if preferences are currently loading
 * @returns {boolean} True if preferences are being loaded
 */
export function isPreferencesLoading() {
  return state.isLoading;
}

/**
 * Set loading state
 * @param {boolean} loading - Loading state
 */
export function setPreferencesLoading(loading) {
  state.isLoading = loading;
}

/**
 * Subscribe to preference changes
 * @param {Function} callback - Callback function (newPrefs, oldPrefs) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPreferences(callback) {
  state.subscribers.add(callback);
  return () => state.subscribers.delete(callback);
}

/**
 * Notify all subscribers of preference changes
 * @param {Preferences} newPrefs - New preferences
 * @param {Preferences} oldPrefs - Previous preferences
 */
function notifySubscribers(newPrefs, oldPrefs) {
  state.subscribers.forEach((callback) => {
    try {
      callback(newPrefs, oldPrefs);
    } catch (error) {
      console.error('[PreferencesState] Subscriber error:', error);
    }
  });
}

/**
 * Reset preferences to defaults
 */
export function resetPreferences() {
  const oldPreferences = state.preferences;
  state.preferences = getDefaultPreferences();
  state.isLoaded = false;
  notifySubscribers(state.preferences, oldPreferences);
}

/**
 * Preferences state module for external access
 */
export const preferencesState = {
  get: getPreferences,
  set: setPreferences,
  update: updatePreferences,
  isLoaded: isPreferencesLoaded,
  isLoading: isPreferencesLoading,
  setLoading: setPreferencesLoading,
  subscribe: subscribeToPreferences,
  reset: resetPreferences,
};

export default preferencesState;
