// Preferences API service

import { getApiUrl } from './api-client.js';
import { getItem } from '../utils/storage.js';

const API_BASE = getApiUrl();

/**
 * Get authentication headers
 * @returns {Object} Headers object with Authorization
 */
function getAuthHeaders() {
  const token = getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Fetch user preferences from the API
 * @returns {Promise<Object>} User preferences
 */
export async function fetchPreferences() {
  const response = await fetch(`${API_BASE}/preferences`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch preferences');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Save user preferences to the API
 * @param {Object} preferences - Preferences to save
 * @returns {Promise<Object>} Updated preferences
 */
export async function savePreferences(preferences) {
  const response = await fetch(`${API_BASE}/preferences`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Invalid preferences');
    }
    throw new Error('Failed to save preferences');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch supported languages from the API
 * @returns {Promise<Array>} List of supported languages
 */
export async function fetchSupportedLanguages() {
  const response = await fetch(`${API_BASE}/preferences/languages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch supported languages');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch default preferences for a locale
 * @param {string} locale - Browser locale (e.g., 'en-US', 'fr-FR')
 * @returns {Promise<Object>} Default preferences for the locale
 */
export async function fetchDefaultPreferences(locale) {
  const url = new URL(`${API_BASE}/preferences/defaults`);
  if (locale) {
    url.searchParams.set('locale', locale);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch default preferences');
  }

  const data = await response.json();
  return data.data;
}

export default {
  fetchPreferences,
  savePreferences,
  fetchSupportedLanguages,
  fetchDefaultPreferences,
};
