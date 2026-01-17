/**
 * Theme management utility
 * Handles light/dark theme switching with cookie persistence and OS preference detection
 */

const THEME_COOKIE_NAME = 'theme-preference';
const THEME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

/**
 * Get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

/**
 * Set cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} maxAge - Max age in seconds
 */
function setCookie(name, value, maxAge) {
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/**
 * Delete cookie by name
 * @param {string} name - Cookie name
 */
function deleteCookie(name) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

/**
 * Get OS/browser theme preference
 * @returns {string} 'light' or 'dark'
 */
function getOSThemePreference() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return THEME_DARK;
  }
  return THEME_LIGHT;
}

/**
 * Get current theme (cookie preference or OS preference)
 * @returns {string} 'light' or 'dark'
 */
function getCurrentTheme() {
  const cookieTheme = getCookie(THEME_COOKIE_NAME);
  if (cookieTheme === THEME_LIGHT || cookieTheme === THEME_DARK) {
    return cookieTheme;
  }
  // No cookie set, use OS preference
  return getOSThemePreference();
}

/**
 * Apply theme to document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  if (theme === THEME_DARK) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

/**
 * Set theme and persist to cookie
 * @param {string} theme - 'light' or 'dark'
 */
function setTheme(theme) {
  if (theme !== THEME_LIGHT && theme !== THEME_DARK) {
    console.error(`Invalid theme: ${theme}`);
    return;
  }

  applyTheme(theme);
  setCookie(THEME_COOKIE_NAME, theme, THEME_COOKIE_MAX_AGE);
}

/**
 * Toggle theme between light and dark
 * @returns {string} New theme ('light' or 'dark')
 */
function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
  setTheme(newTheme);
  return newTheme;
}

/**
 * Initialize theme on page load
 */
function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  return theme;
}

/**
 * Update theme toggle button icon
 * @param {string} theme - Current theme ('light' or 'dark')
 */
function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    // Show moon icon for light mode (to indicate you can switch to dark)
    // Show sun icon for dark mode (to indicate you can switch to light)
    icon.textContent = theme === THEME_LIGHT ? '🌙' : '☀️';
  }
}

/**
 * Listen for OS theme preference changes
 * @param {function} callback - Callback function called with new theme
 */
function watchOSThemeChange(callback) {
  if (!window.matchMedia) return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e) => {
    // Only respond to OS changes if no cookie preference is set
    const cookieTheme = getCookie(THEME_COOKIE_NAME);
    if (!cookieTheme) {
      const newTheme = e.matches ? THEME_DARK : THEME_LIGHT;
      applyTheme(newTheme);
      callback(newTheme);
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
  } else if (mediaQuery.addListener) {
    // Legacy browsers
    mediaQuery.addListener(handler);
  }

  return handler;
}

export {
  THEME_LIGHT,
  THEME_DARK,
  getCurrentTheme,
  setTheme,
  toggleTheme,
  initTheme,
  updateThemeIcon,
  watchOSThemeChange,
  getOSThemePreference,
};
