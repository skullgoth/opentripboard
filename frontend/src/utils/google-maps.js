// US9: Google Maps URL generator for exporting trip routes

/**
 * Generate a Google Maps URL with waypoints for a list of activities
 * @param {Array} activities - List of activities with coordinates
 * @param {Object} options - Options for URL generation
 * @param {string} [options.mode='driving'] - Travel mode (driving, walking, bicycling, transit)
 * @returns {string|null} Google Maps URL or null if no valid locations
 */
export function generateGoogleMapsUrl(activities, options = {}) {
  const { mode = 'driving' } = options;

  // Filter activities with valid coordinates
  const locationsWithCoords = activities
    .filter((a) => a.latitude && a.longitude)
    .sort((a, b) => {
      // Sort by date then time
      const dateA = a.date || a.activity_date || '';
      const dateB = b.date || b.activity_date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const timeA = a.startTime || a.start_time || '00:00';
      const timeB = b.startTime || b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });

  if (locationsWithCoords.length === 0) {
    return null;
  }

  // Google Maps Directions URL format:
  // https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...&travelmode=...

  const baseUrl = 'https://www.google.com/maps/dir/?api=1';

  // First location is origin
  const origin = locationsWithCoords[0];
  const originParam = `${origin.latitude},${origin.longitude}`;

  // Last location is destination
  const destination = locationsWithCoords[locationsWithCoords.length - 1];
  const destinationParam = `${destination.latitude},${destination.longitude}`;

  // Middle locations are waypoints (max 9 for free Google Maps)
  const middleLocations = locationsWithCoords.slice(1, -1);
  const waypointsParam =
    middleLocations.length > 0
      ? middleLocations
          .slice(0, 9) // Google Maps limit
          .map((loc) => `${loc.latitude},${loc.longitude}`)
          .join('|')
      : null;

  // Build URL
  let url = `${baseUrl}&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destinationParam)}&travelmode=${mode}`;

  if (waypointsParam) {
    url += `&waypoints=${encodeURIComponent(waypointsParam)}`;
  }

  return url;
}

/**
 * Generate Google Maps URL for a single location
 * @param {Object} location - Location with coordinates
 * @param {number} location.latitude - Latitude
 * @param {number} location.longitude - Longitude
 * @param {string} [location.name] - Location name for label
 * @returns {string} Google Maps URL
 */
export function generateLocationUrl(location) {
  const { latitude, longitude, name, title, address } = location;

  if (!latitude || !longitude) {
    return null;
  }

  // Use place search if we have a name
  const label = name || title || address;
  if (label) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${latitude},${longitude}`;
  }

  // Just coordinates
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/**
 * Generate Google Maps URL for activities on a specific day
 * @param {Array} activities - All activities
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {Object} options - Options for URL generation
 * @returns {string|null} Google Maps URL or null
 */
export function generateDayRouteUrl(activities, date, options = {}) {
  const dayActivities = activities.filter((a) => {
    const actDate = a.date || a.activity_date || '';
    return actDate.startsWith(date);
  });

  return generateGoogleMapsUrl(dayActivities, options);
}

/**
 * Open Google Maps in a new tab
 * @param {string} url - Google Maps URL
 */
export function openInGoogleMaps(url) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
