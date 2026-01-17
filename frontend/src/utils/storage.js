// T048: Local storage utility with JSON serialization

/**
 * Get an item from localStorage
 * @param {string} key - Storage key
 * @returns {any} Parsed value or null
 */
export function getItem(key) {
  try {
    const item = localStorage.getItem(key);

    if (item === null) {
      return null;
    }

    return JSON.parse(item);
  } catch (error) {
    console.error(`Failed to get item from localStorage: ${key}`, error);
    return null;
  }
}

/**
 * Set an item in localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store (will be JSON stringified)
 */
export function setItem(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Failed to set item in localStorage: ${key}`, error);
  }
}

/**
 * Remove an item from localStorage
 * @param {string} key - Storage key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove item from localStorage: ${key}`, error);
  }
}

/**
 * Clear all items from localStorage
 */
export function clear() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Failed to clear localStorage', error);
  }
}

/**
 * Check if a key exists in localStorage
 * @param {string} key - Storage key
 * @returns {boolean} True if key exists
 */
export function hasItem(key) {
  return localStorage.getItem(key) !== null;
}

/**
 * Get all keys from localStorage
 * @returns {string[]} Array of keys
 */
export function getAllKeys() {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error('Failed to get keys from localStorage', error);
    return [];
  }
}
