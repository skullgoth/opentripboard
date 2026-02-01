// Transport routing service with OSRM integration and Haversine fallback
import { LRUCache } from 'lru-cache';

/**
 * Transport mode speed estimates (km/h)
 */
const TRANSPORT_SPEEDS = {
  walk: 5,
  bike: 15,
  drive: 50,
  train: 80,
  fly: 800,
  boat: 30,
};

/**
 * OSRM profile mapping for road-following routes
 */
const OSRM_PROFILES = {
  walk: 'foot',
  bike: 'bike',
  drive: 'car',
};

/**
 * Calculate Haversine distance between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Routing service for transport between activities
 * Uses OSRM for road-following routes (walk/bike/drive)
 * Uses Haversine for direct-line routes (fly/boat)
 */
export class RoutingService {
  constructor() {
    this.osrmBaseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    this.timeout = 10000; // 10 second timeout
    this.userAgent = process.env.NOMINATIM_USER_AGENT || 'OpenTripBoard/1.0';

    // LRU cache: 500 entries, 24 hour TTL
    this.cache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });

    // Rate limiting: Token bucket for requests
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests (10 req/sec max)
  }

  /**
   * Get route between two points
   * @param {number} fromLat - Origin latitude
   * @param {number} fromLng - Origin longitude
   * @param {number} toLat - Destination latitude
   * @param {number} toLng - Destination longitude
   * @param {string} mode - Transport mode (walk, bike, drive, fly, boat)
   * @returns {Promise<Object>} Route data with distance, duration, geometry
   */
  async getRoute(fromLat, fromLng, toLat, toLng, mode) {
    // Validate coordinates
    if (!this._validateCoordinates(fromLat, fromLng, toLat, toLng)) {
      throw new Error('Invalid coordinates provided');
    }

    // Validate mode
    if (!TRANSPORT_SPEEDS[mode]) {
      throw new Error(`Invalid transport mode: ${mode}`);
    }

    // Check cache
    const cacheKey = this._getCacheKey(fromLat, fromLng, toLat, toLng, mode);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }

    let result;

    // Use OSRM for road-following modes, Haversine for direct-line modes
    if (OSRM_PROFILES[mode]) {
      result = await this._getOsrmRoute(fromLat, fromLng, toLat, toLng, mode);
    } else {
      result = this._getHaversineRoute(fromLat, fromLng, toLat, toLng, mode);
    }

    // Cache the result
    this.cache.set(cacheKey, result);

    return {
      ...result,
      cached: false,
    };
  }

  /**
   * Get route from OSRM (road-following)
   * @private
   */
  async _getOsrmRoute(fromLat, fromLng, toLat, toLng, mode) {
    const profile = OSRM_PROFILES[mode];

    // Rate limiting
    await this._rateLimit();

    const url = `${this.osrmBaseUrl}/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        if (response.status === 503) {
          throw new Error('SERVICE_UNAVAILABLE');
        }
        // Fall back to Haversine on OSRM errors
        console.warn(`OSRM returned ${response.status}, falling back to Haversine`);
        return this._getHaversineRoute(fromLat, fromLng, toLat, toLng, mode);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        // No route found, fall back to Haversine
        console.warn('OSRM found no route, falling back to Haversine');
        return this._getHaversineRoute(fromLat, fromLng, toLat, toLng, mode);
      }

      const route = data.routes[0];

      return {
        distance: route.distance / 1000, // Convert meters to km
        duration: route.duration / 60, // Convert seconds to minutes
        geometry: route.geometry.coordinates, // GeoJSON coordinates array
        provider: 'osrm',
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('OSRM request timed out, falling back to Haversine');
        return this._getHaversineRoute(fromLat, fromLng, toLat, toLng, mode);
      }

      // For any network error, fall back to Haversine
      console.warn(`OSRM error: ${error.message}, falling back to Haversine`);
      return this._getHaversineRoute(fromLat, fromLng, toLat, toLng, mode);
    }
  }

  /**
   * Get route using Haversine (direct line)
   * @private
   */
  _getHaversineRoute(fromLat, fromLng, toLat, toLng, mode) {
    const distance = haversineDistance(fromLat, fromLng, toLat, toLng);
    const speed = TRANSPORT_SPEEDS[mode];
    const duration = (distance / speed) * 60; // Convert hours to minutes

    return {
      distance,
      duration,
      geometry: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      provider: 'haversine',
    };
  }

  /**
   * Validate coordinate values
   * @private
   */
  _validateCoordinates(lat1, lng1, lat2, lng2) {
    return (
      typeof lat1 === 'number' &&
      typeof lng1 === 'number' &&
      typeof lat2 === 'number' &&
      typeof lng2 === 'number' &&
      lat1 >= -90 &&
      lat1 <= 90 &&
      lat2 >= -90 &&
      lat2 <= 90 &&
      lng1 >= -180 &&
      lng1 <= 180 &&
      lng2 >= -180 &&
      lng2 <= 180
    );
  }

  /**
   * Generate cache key
   * @private
   */
  _getCacheKey(fromLat, fromLng, toLat, toLng, mode) {
    // Round to 5 decimal places (about 1.1m precision)
    const precision = 5;
    return `${fromLat.toFixed(precision)},${fromLng.toFixed(precision)}-${toLat.toFixed(precision)},${toLng.toFixed(precision)}-${mode}`;
  }

  /**
   * Rate limiting
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
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Singleton instance
 */
let routingServiceInstance;

/**
 * Get routing service instance (singleton)
 * @returns {RoutingService}
 */
export function getRoutingService() {
  if (!routingServiceInstance) {
    routingServiceInstance = new RoutingService();
  }
  return routingServiceInstance;
}

/**
 * Get transport mode speeds
 * @returns {Object}
 */
export function getTransportSpeeds() {
  return { ...TRANSPORT_SPEEDS };
}

/**
 * Get valid transport modes
 * @returns {string[]}
 */
export function getValidTransportModes() {
  return Object.keys(TRANSPORT_SPEEDS);
}
