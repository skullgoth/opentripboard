// Site configuration database queries
import { query } from '../connection.js';

/**
 * Get a site config value by key
 * @param {string} key - Config key
 * @returns {Promise<any>} Config value or null
 */
export async function getConfigValue(key) {
  const result = await query('SELECT value FROM site_config WHERE key = $1', [key]);
  return result.rows.length > 0 ? result.rows[0].value : null;
}

/**
 * Set a site config value
 * @param {string} key - Config key
 * @param {any} value - Config value (will be stored as JSONB)
 * @param {string} description - Optional description
 * @returns {Promise<Object>} Updated config row
 */
export async function setConfigValue(key, value, description = null) {
  const result = await query(
    `INSERT INTO site_config (key, value, description, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = $2, updated_at = NOW()
     RETURNING *`,
    [key, JSON.stringify(value), description]
  );
  return result.rows[0];
}

/**
 * Get all site config values
 * @returns {Promise<Array>} Array of config rows
 */
export async function getAllConfig() {
  const result = await query(
    'SELECT key, value, description, updated_at FROM site_config ORDER BY key'
  );
  return result.rows;
}

/**
 * Check if registration is enabled
 * @returns {Promise<boolean>} True if registration is enabled
 */
export async function isRegistrationEnabled() {
  const value = await getConfigValue('registration_enabled');
  // Default to true if not set
  return value === null ? true : value === true;
}

/**
 * Set registration enabled status
 * @param {boolean} enabled - Whether registration should be enabled
 * @returns {Promise<Object>} Updated config
 */
export async function setRegistrationEnabled(enabled) {
  return setConfigValue(
    'registration_enabled',
    enabled,
    'Controls whether new user registration is allowed'
  );
}
