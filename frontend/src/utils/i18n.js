// i18n utility for internationalization
// US2: Language preference support

import { getPreferences } from '../state/preferences-state.js';
import { logError, logWarning } from './error-tracking.js';

/**
 * Translation store
 */
let translations = {};
let currentLanguage = 'en';
let isLoaded = false;

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

/**
 * Load translations for a language
 * @param {string} lang - Language code (en, fr, es)
 * @returns {Promise<Object>} Translations object
 */
export async function loadTranslations(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${lang}`);
    }
    const data = await response.json();
    translations[lang] = data;
    return data;
  } catch (error) {
    logError(`[i18n] Failed to load ${lang} translations:`, error);
    // Fall back to English if available
    if (lang !== 'en' && translations['en']) {
      return translations['en'];
    }
    return {};
  }
}

/**
 * Initialize i18n with user's preferred language
 * @param {string} [lang] - Language code (optional, uses preferences if not provided)
 * @returns {Promise<void>}
 */
export async function initI18n(lang) {
  const language = lang || getPreferences().language || 'en';
  const previousLanguage = currentLanguage;

  // Always load English as fallback
  if (!translations['en']) {
    await loadTranslations('en');
  }

  // Load requested language if not English
  if (language !== 'en' && !translations[language]) {
    await loadTranslations(language);
  }

  currentLanguage = language;
  isLoaded = true;

  // Update document language attribute
  document.documentElement.lang = language;

  // Notify listeners if language changed
  if (previousLanguage !== language) {
    notifyLanguageChange(language);
  }
}

/**
 * Set the current language
 * @param {string} lang - Language code
 * @returns {Promise<void>}
 */
export async function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.find(l => l.code === lang)) {
    logWarning(`[i18n] Unsupported language: ${lang}`);
    return;
  }

  // Load translations if not already loaded
  if (!translations[lang]) {
    await loadTranslations(lang);
  }

  currentLanguage = lang;
  document.documentElement.lang = lang;

  // Notify listeners
  notifyLanguageChange(lang);
}

/**
 * Get the current language
 * @returns {string} Current language code
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Translate a key
 * @param {string} key - Translation key (dot notation, e.g., 'nav.home')
 * @param {Object} [params] - Interpolation parameters
 * @returns {string} Translated string or key if not found
 */
export function t(key, params = {}) {
  // Get translation from current language or fall back to English
  let value = getNestedValue(translations[currentLanguage], key);

  if (value === undefined) {
    value = getNestedValue(translations['en'], key);
  }

  if (value === undefined) {
    // Only warn if translations are loaded (avoid noise during initialization)
    if (isLoaded) {
      logWarning(`[i18n] Missing translation: ${key}`);
    }
    return key;
  }

  // Interpolate parameters
  return interpolate(value, params);
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot-notation path (e.g., 'nav.home')
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Interpolate parameters into a string
 * @param {string} str - String with {{param}} placeholders
 * @param {Object} params - Parameters to interpolate
 * @returns {string} Interpolated string
 */
function interpolate(str, params) {
  if (!params || Object.keys(params).length === 0) {
    return str;
  }

  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

/**
 * Language change listeners
 */
const languageChangeListeners = new Set();

/**
 * Subscribe to language changes
 * @param {Function} callback - Callback function (receives new language code)
 * @returns {Function} Unsubscribe function
 */
export function onLanguageChange(callback) {
  languageChangeListeners.add(callback);
  return () => languageChangeListeners.delete(callback);
}

/**
 * Notify listeners of language change
 * @param {string} lang - New language code
 */
function notifyLanguageChange(lang) {
  languageChangeListeners.forEach(callback => {
    try {
      callback(lang);
    } catch (error) {
      logError('[i18n] Language change listener error:', error);
    }
  });
}

/**
 * Check if translations are loaded
 * @returns {boolean} True if loaded
 */
export function isI18nLoaded() {
  return isLoaded;
}

/**
 * Get all translations for current language (for debugging)
 * @returns {Object} Current translations
 */
export function getTranslations() {
  return translations[currentLanguage] || {};
}

export default {
  t,
  initI18n,
  setLanguage,
  getLanguage,
  onLanguageChange,
  isI18nLoaded,
  SUPPORTED_LANGUAGES,
};
