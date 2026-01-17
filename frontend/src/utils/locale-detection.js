// Browser locale detection utility

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'es'];

/**
 * Get the browser's preferred language
 * @returns {string} Language code (en, fr, es) or 'en' as fallback
 */
export function getBrowserLanguage() {
  const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
}

/**
 * Get the full browser locale (e.g., 'en-US', 'fr-FR')
 * @returns {string} Browser locale string
 */
export function getBrowserLocale() {
  return navigator.language || 'en-US';
}

/**
 * Detect default preferences based on browser locale
 * @returns {Object} Default preferences object
 */
export function detectDefaultPreferences() {
  const locale = getBrowserLocale();
  const lang = locale.split('-')[0]?.toLowerCase();
  const region = locale.split('-')[1]?.toUpperCase();

  // Language - use browser language if supported
  const language = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';

  // Date format - US uses mdy, most other countries use dmy
  const useMdy = region === 'US' || (lang === 'en' && !region);
  const dateFormat = useMdy ? 'mdy' : 'dmy';

  // Time format - US/UK/AU typically use 12h, most of Europe uses 24h
  const use12h = ['US', 'GB', 'AU', 'CA'].includes(region) || lang === 'en';
  const timeFormat = use12h ? '12h' : '24h';

  // Distance format - US/UK use miles, most other countries use km
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
 * Get default preferences (detected from browser or hardcoded fallback)
 * @returns {Object} Default preferences
 */
export function getDefaultPreferences() {
  try {
    return detectDefaultPreferences();
  } catch {
    // Fallback if detection fails
    return {
      language: 'en',
      dateFormat: 'mdy',
      timeFormat: '12h',
      distanceFormat: 'mi',
    };
  }
}
