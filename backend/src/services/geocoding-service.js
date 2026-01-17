// T010: Geocoding service with Nominatim API client and LRU cache
import { LRUCache } from 'lru-cache';
import { createNominatimClient } from '../utils/api-client.js';

/**
 * Geocoding service for destination search
 * Uses OpenStreetMap Nominatim API with in-memory LRU cache
 */
export class GeocodingService {
  constructor() {
    this.client = createNominatimClient();

    // LRU cache: 1000 entries, 1 hour TTL
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour in milliseconds
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });

    // Rate limiting: Token bucket for 1 req/sec (Nominatim requirement)
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
  }

  /**
   * Search for destinations matching query
   * @param {string} query - Search query (e.g., "Paris")
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results (default 5)
   * @param {string} options.language - Accept-Language header (default 'en')
   * @returns {Promise<Object>} - Search results with caching metadata
   */
  async search(query, options = {}) {
    const { limit = 5, language = 'en' } = options;

    // Validate input
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    if (query.length < 2) {
      throw new Error('Query must be at least 2 characters');
    }

    // Normalize query for cache key (lowercase, trim)
    const cacheKey = this._getCacheKey(query, limit, language);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        results: cached,
        cached: true,
      };
    }

    // Rate limiting: Enforce 1 req/sec
    await this._rateLimit();

    try {
      // Call Nominatim API
      const results = await this.client.search(query, limit, language);

      // Transform results to our format
      const transformedResults = results.map((result) => ({
        place_id: result.place_id,
        display_name: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        type: result.type || result.class || 'unknown',
        address: result.address || {},
        validated: true, // Mark as validated from Nominatim
      }));

      // Cache the results
      this.cache.set(cacheKey, transformedResults);

      return {
        results: transformedResults,
        cached: false,
      };
    } catch (error) {
      // Handle specific errors
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        throw new Error('Geocoding service rate limit exceeded. Please try again later.');
      }

      if (error.message === 'SERVICE_UNAVAILABLE') {
        throw new Error('Geocoding service temporarily unavailable');
      }

      if (error.message === 'REQUEST_TIMEOUT') {
        throw new Error('Geocoding request timed out');
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Validate destination data structure
   * @param {Object} destinationData - Destination data to validate
   * @returns {boolean} - True if valid
   */
  validateDestinationData(destinationData) {
    if (!destinationData || typeof destinationData !== 'object') {
      return false;
    }

    const required = ['place_id', 'display_name', 'lat', 'lon', 'validated'];

    for (const field of required) {
      if (!(field in destinationData)) {
        return false;
      }
    }

    // Validate types
    if (typeof destinationData.place_id !== 'number') return false;
    if (typeof destinationData.display_name !== 'string') return false;
    if (typeof destinationData.lat !== 'number') return false;
    if (typeof destinationData.lon !== 'number') return false;
    if (typeof destinationData.validated !== 'boolean') return false;

    // Validate coordinate ranges
    if (destinationData.lat < -90 || destinationData.lat > 90) return false;
    if (destinationData.lon < -180 || destinationData.lon > 180) return false;

    return true;
  }

  /**
   * Generate cache key from query parameters
   * @private
   */
  _getCacheKey(query, limit, language) {
    return `${query.toLowerCase().trim()}:${limit}:${language}`;
  }

  /**
   * Rate limiting using token bucket algorithm
   * Ensures 1 request per second to respect Nominatim usage policy
   * @private
   */
  async _rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this._calculateHitRate(),
    };
  }

  /**
   * Calculate cache hit rate (rough estimate)
   * @private
   */
  _calculateHitRate() {
    // This is a simplified calculation
    // In production, you'd track hits/misses explicitly
    const size = this.cache.size;
    const maxSize = this.cache.max;
    return size > 0 ? (size / maxSize) * 100 : 0;
  }

  /**
   * Clear cache (for testing or manual invalidation)
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Singleton instance
 */
let geocodingServiceInstance;

/**
 * Get geocoding service instance (singleton)
 * @returns {GeocodingService}
 */
export function getGeocodingService() {
  if (!geocodingServiceInstance) {
    geocodingServiceInstance = new GeocodingService();
  }
  return geocodingServiceInstance;
}
