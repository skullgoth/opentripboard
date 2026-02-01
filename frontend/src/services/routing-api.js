// Transport routing API client service

import { get, APIError } from './api-client.js';
import { t } from '../utils/i18n.js';

/**
 * Valid transport modes
 */
export const TRANSPORT_MODES = ['walk', 'bike', 'drive', 'train', 'fly', 'boat'];

/**
 * Get route between two points
 * @param {number} fromLat - Origin latitude
 * @param {number} fromLng - Origin longitude
 * @param {number} toLat - Destination latitude
 * @param {number} toLng - Destination longitude
 * @param {string} mode - Transport mode (walk, bike, drive, fly, boat)
 * @returns {Promise<Object>} - Route data with distance, duration, geometry
 */
export async function getRoute(fromLat, fromLng, toLat, toLng, mode) {
  // Validate mode
  if (!TRANSPORT_MODES.includes(mode)) {
    throw new Error(`Invalid transport mode: ${mode}`);
  }

  // Validate coordinates
  if (typeof fromLat !== 'number' || typeof fromLng !== 'number' ||
      typeof toLat !== 'number' || typeof toLng !== 'number') {
    throw new Error('Invalid coordinates');
  }

  try {
    const params = new URLSearchParams({
      fromLat: fromLat.toString(),
      fromLng: fromLng.toString(),
      toLat: toLat.toString(),
      toLng: toLng.toString(),
      mode,
    });

    const data = await get(`/routing?${params.toString()}`);

    return {
      distance: data.distance, // km
      duration: data.duration, // minutes
      geometry: data.geometry, // GeoJSON coordinates
      provider: data.provider, // 'osrm' or 'haversine'
      cached: data.cached || false,
    };
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 503) {
        throw new Error('SERVICE_UNAVAILABLE');
      }
      if (error.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      if (error.status === 400) {
        throw new Error('INVALID_REQUEST');
      }
    }

    console.error('Routing API error:', error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
}

/**
 * Check routing service health
 * @returns {Promise<Object>} - Health status and cache stats
 */
export async function checkHealth() {
  try {
    const data = await get('/routing/health');
    return data;
  } catch (error) {
    console.error('Routing health check error:', error);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Format duration in minutes to human-readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration (e.g., "2h 30m" or "45mn" in French)
 */
export function formatDuration(minutes) {
  if (!minutes || minutes < 1) return t('transport.lessThanOneMinute', '< 1m');

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const hoursAbbrev = t('transport.hours', 'h');
  const minsAbbrev = t('transport.minutes', 'm');

  if (hours === 0) {
    return `${mins}${minsAbbrev}`;
  }

  if (mins === 0) {
    return `${hours}${hoursAbbrev}`;
  }

  return `${hours}${hoursAbbrev} ${mins}${minsAbbrev}`;
}

/**
 * Format distance in km to human-readable string
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance (e.g., "714 km" or "2.5 km")
 */
export function formatDistance(km) {
  if (!km || km < 0.1) return t('transport.lessThanDistance', '< 0.1 km');

  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }

  return `${Math.round(km)} km`;
}
