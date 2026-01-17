// T049: Date helpers for formatting and timezone handling
// Updated for user preferences support

import { getPreferences } from '../state/preferences-state.js';

/**
 * Map language code to locale with date format suffix
 * @param {string} language - Language code (en, fr, es)
 * @param {string} dateFormat - Date format preference (mdy, dmy)
 * @returns {string} Locale string for Intl API
 */
function getLocaleForLanguage(language, dateFormat) {
  // Map language codes to base locales
  const languageMap = {
    en: dateFormat === 'dmy' ? 'en-GB' : 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
  };
  return languageMap[language] || languageMap.en;
}

/**
 * Get locale based on user's language and date format preferences
 * @returns {string} Locale string for Intl API
 */
function getDateLocale() {
  const prefs = getPreferences();
  return getLocaleForLanguage(prefs.language || 'en', prefs.dateFormat || 'mdy');
}

/**
 * Check if user prefers 12-hour time format
 * @returns {boolean} True if 12-hour format preferred
 */
function use12HourFormat() {
  const prefs = getPreferences();
  return prefs.timeFormat === '12h';
}

/**
 * Format a date to a readable string (preference-aware)
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type ('short', 'medium', 'long', 'full')
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'medium') {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getDateLocale();

  const options = {
    short: { month: 'numeric', day: 'numeric', year: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  };

  return d.toLocaleDateString(locale, options[format]);
}

/**
 * Format a date and time (preference-aware)
 * @param {Date|string} date - Date to format
 * @param {boolean} includeSeconds - Include seconds in time
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, includeSeconds = false) {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const locale = getDateLocale();
  const dateStr = formatDate(d, 'medium');
  const timeStr = d.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: use12HourFormat(),
  });

  return `${dateStr} ${timeStr}`;
}

/**
 * Format a time (preference-aware)
 * @param {Date|string} date - Date to format
 * @param {boolean} includeSeconds - Include seconds
 * @returns {string} Formatted time string
 */
export function formatTime(date, includeSeconds = false) {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Time';
  }

  return d.toLocaleTimeString('en', {
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: use12HourFormat(),
  });
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateForInput(date) {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a datetime for input fields (YYYY-MM-DDTHH:mm)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeForInput(date) {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Calculate duration between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} Duration object with days, hours, minutes
 */
export function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const diff = end.getTime() - start.getTime();

  if (diff < 0) {
    return { days: 0, hours: 0, minutes: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes };
}

/**
 * Format duration as human-readable string
 * @param {Object} duration - Duration object from calculateDuration
 * @returns {string} Formatted duration string
 */
export function formatDuration(duration) {
  const parts = [];

  if (duration.days > 0) {
    parts.push(`${duration.days} day${duration.days !== 1 ? 's' : ''}`);
  }

  if (duration.hours > 0) {
    parts.push(`${duration.hours} hour${duration.hours !== 1 ? 's' : ''}`);
  }

  if (duration.minutes > 0 || parts.length === 0) {
    parts.push(`${duration.minutes} minute${duration.minutes !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  const d = new Date(date);
  const now = new Date();

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const diff = now.getTime() - d.getTime();
  const absDiff = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const isPast = diff > 0;
  const prefix = isPast ? '' : 'in ';
  const suffix = isPast ? ' ago' : '';

  if (absDiff < minute) {
    return 'just now';
  } else if (absDiff < hour) {
    const minutes = Math.floor(absDiff / minute);
    return `${prefix}${minutes} minute${minutes !== 1 ? 's' : ''}${suffix}`;
  } else if (absDiff < day) {
    const hours = Math.floor(absDiff / hour);
    return `${prefix}${hours} hour${hours !== 1 ? 's' : ''}${suffix}`;
  } else if (absDiff < week) {
    const days = Math.floor(absDiff / day);
    return `${prefix}${days} day${days !== 1 ? 's' : ''}${suffix}`;
  } else if (absDiff < month) {
    const weeks = Math.floor(absDiff / week);
    return `${prefix}${weeks} week${weeks !== 1 ? 's' : ''}${suffix}`;
  } else if (absDiff < year) {
    const months = Math.floor(absDiff / month);
    return `${prefix}${months} month${months !== 1 ? 's' : ''}${suffix}`;
  } else {
    const years = Math.floor(absDiff / year);
    return `${prefix}${years} year${years !== 1 ? 's' : ''}${suffix}`;
  }
}

/**
 * Check if a date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
  const d = new Date(date);
  return d.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFuture(date) {
  const d = new Date(date);
  return d.getTime() > Date.now();
}

/**
 * Check if a date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
  const d = new Date(date);
  const today = new Date();

  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate();
}
