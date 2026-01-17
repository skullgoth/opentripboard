// Site configuration API service
import apiClient from './api-client.js';

/**
 * Fetch public site configuration (no auth required)
 * @returns {Promise<Object>} Site configuration
 */
export async function fetchPublicSiteConfig() {
  const response = await apiClient.get('/site-config/public');
  return response.data;
}

/**
 * Fetch admin site configuration
 * @returns {Promise<Object>} Full site configuration
 */
export async function fetchAdminSiteConfig() {
  const response = await apiClient.get('/admin/site-config');
  return response.data;
}

/**
 * Update site configuration (admin only)
 * @param {Object} updates - Configuration updates
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateSiteConfig(updates) {
  const response = await apiClient.patch('/admin/site-config', updates);
  return response.data;
}
