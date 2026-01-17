// Site configuration state management

/**
 * @typedef {Object} SiteConfig
 * @property {boolean} registrationEnabled - Whether registration is allowed
 */

const state = {
  /** @type {SiteConfig|null} */
  config: null,
  /** @type {boolean} */
  isLoaded: false,
  /** @type {Set<Function>} */
  subscribers: new Set(),
};

/**
 * Get current site config
 * @returns {SiteConfig|null} Current config or null if not loaded
 */
export function getSiteConfig() {
  return state.config ? { ...state.config } : null;
}

/**
 * Set site config
 * @param {SiteConfig} config - Site configuration
 */
export function setSiteConfig(config) {
  state.config = { ...config };
  state.isLoaded = true;
  notifySubscribers();
}

/**
 * Check if registration is enabled
 * @returns {boolean} True if registration is enabled (defaults to true if not loaded)
 */
export function isRegistrationEnabled() {
  return state.config?.registrationEnabled ?? true;
}

/**
 * Check if site config is loaded
 * @returns {boolean} True if config has been loaded
 */
export function isSiteConfigLoaded() {
  return state.isLoaded;
}

/**
 * Subscribe to config changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSiteConfig(callback) {
  state.subscribers.add(callback);
  return () => state.subscribers.delete(callback);
}

function notifySubscribers() {
  state.subscribers.forEach((callback) => {
    try {
      callback(state.config);
    } catch (error) {
      console.error('[SiteConfigState] Subscriber error:', error);
    }
  });
}

export const siteConfigState = {
  get: getSiteConfig,
  set: setSiteConfig,
  isRegistrationEnabled,
  isLoaded: isSiteConfigLoaded,
  subscribe: subscribeToSiteConfig,
};

export default siteConfigState;
