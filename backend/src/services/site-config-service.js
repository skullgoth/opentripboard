// Site configuration service - business logic for site settings
import { isRegistrationEnabled, setRegistrationEnabled } from '../db/queries/site-config.js';

// Cache for registration status (avoid DB hit on every request)
let registrationEnabledCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get registration enabled status (cached)
 * @returns {Promise<boolean>} True if registration is enabled
 */
export async function getRegistrationEnabled() {
  const now = Date.now();
  if (registrationEnabledCache !== null && now < cacheExpiry) {
    return registrationEnabledCache;
  }

  const enabled = await isRegistrationEnabled();
  registrationEnabledCache = enabled;
  cacheExpiry = now + CACHE_TTL;
  return enabled;
}

/**
 * Set registration enabled status
 * @param {boolean} enabled - Whether registration should be enabled
 * @returns {Promise<boolean>} Updated status
 */
export async function updateRegistrationEnabled(enabled) {
  await setRegistrationEnabled(enabled);
  // Update cache immediately
  registrationEnabledCache = enabled;
  cacheExpiry = Date.now() + CACHE_TTL;
  return enabled;
}

/**
 * Get public site settings (no auth required)
 * @returns {Promise<Object>} Public site settings
 */
export async function getPublicSettings() {
  const registrationEnabled = await getRegistrationEnabled();
  return {
    registrationEnabled,
  };
}

/**
 * Clear the configuration cache
 */
export function clearCache() {
  registrationEnabledCache = null;
  cacheExpiry = 0;
}

export default {
  getRegistrationEnabled,
  updateRegistrationEnabled,
  getPublicSettings,
  clearCache,
};
