// T174: Route optimizer service - optimize travel routes using nearest neighbor algorithm
import logger from '../utils/logger.js';

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  // Haversine formula: calculates great-circle distance between two points on a sphere.
  // 'a' is the square of half the chord length between the points.
  // Using sin^2(dLat/2) + cos(lat1)*cos(lat2)*sin^2(dLon/2) avoids floating-point
  // issues that arise with the simpler spherical law of cosines at short distances.
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // 'c' is the angular distance in radians. atan2 is used instead of asin
  // for better numerical stability when points are nearly antipodal.
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated travel time based on distance
 * Assumes average speed of 50 km/h for driving
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Time in minutes
 */
function calculateTravelTime(distanceKm) {
  const averageSpeed = 50; // km/h
  const timeHours = distanceKm / averageSpeed;
  return Math.round(timeHours * 60); // Convert to minutes
}

/**
 * Optimize route using nearest neighbor algorithm (greedy approach to TSP)
 * @param {Array} activities - Array of activity objects with latitude and longitude
 * @param {Object} options - Optimization options
 * @param {string} options.startPoint - 'first' or 'nearest' - how to choose starting point
 * @returns {Object} Optimized route with reordered activities and total distance
 */
export function optimizeRoute(activities, options = {}) {
  const { startPoint = 'first' } = options;

  // Filter activities that have valid coordinates
  const validActivities = activities.filter(
    activity => activity.latitude !== null && activity.longitude !== null
  );

  if (validActivities.length === 0) {
    logger.warn('No activities with valid coordinates to optimize');
    return {
      activities: [],
      totalDistance: 0,
      totalTravelTime: 0,
      message: 'No activities with coordinates to optimize'
    };
  }

  if (validActivities.length === 1) {
    return {
      activities: validActivities,
      totalDistance: 0,
      totalTravelTime: 0,
      message: 'Only one activity with coordinates'
    };
  }

  // Nearest neighbor heuristic for the Traveling Salesman Problem (TSP).
  // TSP is NP-hard, so we use this greedy O(n^2) approximation: at each step,
  // visit the closest unvisited location. This typically produces routes within
  // 20-25% of optimal, which is acceptable for trip itinerary suggestions.
  const unvisited = [...validActivities];
  const route = [];
  let totalDistance = 0;

  // Select starting point
  let current;
  if (startPoint === 'first') {
    current = unvisited.shift();
  } else {
    // Start from southernmost activity as a consistent deterministic anchor point
    const startIndex = unvisited.reduce((minIdx, curr, idx, arr) =>
      curr.latitude < arr[minIdx].latitude ? idx : minIdx, 0);
    current = unvisited.splice(startIndex, 1)[0];
  }

  route.push(current);

  // Greedily select the nearest unvisited activity from the current position,
  // building the route incrementally until all activities are visited
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.latitude,
        current.longitude,
        unvisited[i].latitude,
        unvisited[i].longitude
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIdx = i;
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0];
    route.push(current);
    totalDistance += nearestDistance;
  }

  const totalTravelTime = calculateTravelTime(totalDistance);

  logger.info(`Route optimized: ${route.length} activities, ${totalDistance.toFixed(2)} km, ${totalTravelTime} min`);

  return {
    activities: route,
    totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimals
    totalTravelTime,
    message: `Optimized route with ${route.length} activities`
  };
}

/**
 * Calculate total distance for a given route
 * @param {Array} activities - Array of activities in order
 * @returns {Object} Distance and travel time information
 */
export function calculateRouteMetrics(activities) {
  const validActivities = activities.filter(
    activity => activity.latitude !== null && activity.longitude !== null
  );

  if (validActivities.length < 2) {
    return {
      totalDistance: 0,
      totalTravelTime: 0,
      segments: []
    };
  }

  let totalDistance = 0;
  const segments = [];

  for (let i = 0; i < validActivities.length - 1; i++) {
    const from = validActivities[i];
    const to = validActivities[i + 1];
    const distance = calculateDistance(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );

    totalDistance += distance;
    segments.push({
      from: from.id,
      to: to.id,
      distance: Math.round(distance * 100) / 100,
      travelTime: calculateTravelTime(distance)
    });
  }

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalTravelTime: calculateTravelTime(totalDistance),
    segments
  };
}

/**
 * Calculate distance between two specific activities
 * @param {Object} activity1 - First activity with latitude/longitude
 * @param {Object} activity2 - Second activity with latitude/longitude
 * @returns {Object} Distance and travel time
 */
export function calculateDistanceBetween(activity1, activity2) {
  if (!activity1.latitude || !activity1.longitude ||
      !activity2.latitude || !activity2.longitude) {
    return {
      distance: null,
      travelTime: null,
      error: 'Both activities must have valid coordinates'
    };
  }

  const distance = calculateDistance(
    activity1.latitude,
    activity1.longitude,
    activity2.latitude,
    activity2.longitude
  );

  return {
    distance: Math.round(distance * 100) / 100,
    travelTime: calculateTravelTime(distance)
  };
}
