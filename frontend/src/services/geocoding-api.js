// T016: Geocoding API client service for destination search

import { get, APIError } from './api-client.js';
import { logError } from '../utils/error-tracking.js';

/**
 * Search for destinations
 * @param {string} query - Search query (minimum 2 characters)
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum results (default 5)
 * @param {string} options.language - Language code (default 'en')
 * @returns {Promise<Object>} - Object with results array and cached boolean
 */
export async function searchDestinations(query, options = {}) {
  const { limit = 5, language = 'en' } = options;

  // Validate query
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  if (query.trim().length < 2) {
    throw new Error('Query must be at least 2 characters');
  }

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      limit: limit.toString(),
      language,
    });

    // get() returns parsed JSON data directly, not Response object
    const data = await get(`/geocoding/search?${params.toString()}`);

    return {
      results: data.results || [],
      cached: data.cached || false,
    };
  } catch (error) {
    // Handle APIError from api-client.js
    if (error instanceof APIError) {
      if (error.status === 503) {
        throw new Error('SERVICE_UNAVAILABLE');
      }
      if (error.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      if (error.status === 400) {
        throw new Error('INVALID_QUERY');
      }
    }

    // Network errors or unexpected errors
    logError('Geocoding API error:', error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
}

/**
 * Check geocoding service health
 * @returns {Promise<Object>} - Health status and cache stats
 */
export async function checkHealth() {
  try {
    // get() returns parsed JSON data directly
    const data = await get('/geocoding/health');
    return data;
  } catch (error) {
    logError('Geocoding health check error:', error);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}
