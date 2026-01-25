// T066: ActivityService - activity CRUD and reordering
import * as activityQueries from '../db/queries/activities.js';
import * as tripQueries from '../db/queries/trips.js';
import { checkAccess, checkPermission } from './trip-buddy-service.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';
import { DEFAULT_ACTIVITY_TYPES, isCustomCategory } from '../utils/default-categories.js';

// Build valid types from default categories + legacy/reservation types
const VALID_ACTIVITY_TYPES = [
  ...DEFAULT_ACTIVITY_TYPES.map(cat => cat.key),
  // Legacy types (for backward compatibility)
  'accommodation', 'transportation', 'attraction', 'meeting', 'event',
  // Reservation types that might be used as activity types
  'hotel', 'rental', 'hostel', 'camping', 'resort',
  'flight', 'train', 'bus', 'car', 'ferry', 'cruise', 'taxi', 'transfer',
  'bar',
];

/**
 * Check if a type is valid (either in the list or a custom category reference)
 * @param {string} type - Activity type to validate
 * @returns {boolean} True if valid
 */
function isValidActivityType(type) {
  return VALID_ACTIVITY_TYPES.includes(type) || isCustomCategory(type);
}

/**
 * Create a new activity
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @param {Object} activityData - Activity data
 * @returns {Promise<Object>} Created activity
 */
export async function create(tripId, userId, activityData) {
  // Verify trip exists and user has editor permission
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  const canEdit = await checkPermission(tripId, userId, ['owner', 'editor']);
  if (!canEdit) {
    throw new AuthorizationError('You do not have permission to add activities to this trip');
  }

  // Validate activity data
  const { type, title, description, location, latitude, longitude, startTime, endTime, orderIndex, metadata } = activityData;

  if (!type || !isValidActivityType(type)) {
    throw new ValidationError('Activity type must be a valid default type or a custom category reference (custom:uuid)');
  }

  if (!title || title.trim().length === 0) {
    throw new ValidationError('Activity title is required');
  }

  // Validate time range
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end < start) {
      throw new ValidationError('End time must be after start time');
    }
  }

  // Validate activity dates are within trip date range
  if (startTime) {
    const activityStartDate = new Date(startTime).toISOString().split('T')[0];
    if (trip.start_date) {
      const tripStartDate = new Date(trip.start_date).toISOString().split('T')[0];
      if (activityStartDate < tripStartDate) {
        throw new ValidationError('Activity start time must be on or after the trip start date');
      }
    }
    if (trip.end_date) {
      const tripEndDate = new Date(trip.end_date).toISOString().split('T')[0];
      if (activityStartDate > tripEndDate) {
        throw new ValidationError('Activity start time must be on or before the trip end date');
      }
    }
  }

  if (endTime) {
    const activityEndDate = new Date(endTime).toISOString().split('T')[0];
    if (trip.start_date) {
      const tripStartDate = new Date(trip.start_date).toISOString().split('T')[0];
      if (activityEndDate < tripStartDate) {
        throw new ValidationError('Activity end time must be on or after the trip start date');
      }
    }
    if (trip.end_date) {
      const tripEndDate = new Date(trip.end_date).toISOString().split('T')[0];
      if (activityEndDate > tripEndDate) {
        throw new ValidationError('Activity end time must be on or before the trip end date');
      }
    }
  }

  // Validate coordinates
  if ((latitude !== undefined && latitude !== null) || (longitude !== undefined && longitude !== null)) {
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }
  }

  // Create activity
  const activity = await activityQueries.create({
    tripId,
    type,
    title: title.trim(),
    description: description?.trim() || null,
    location: location?.trim() || null,
    latitude: latitude || null,
    longitude: longitude || null,
    startTime: startTime || null,
    endTime: endTime || null,
    orderIndex: orderIndex !== undefined ? orderIndex : 0,
    metadata: metadata || {},
    createdBy: userId, // T150: Track who created the activity
  });

  return formatActivity(activity);
}

/**
 * Get all activities for a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of activities
 */
export async function listByTrip(tripId, userId) {
  // Verify trip exists and user has access
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const activities = await activityQueries.findByTripId(tripId);
  return activities.map(formatActivity);
}

/**
 * Get activity by ID
 * @param {string} activityId - Activity ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Activity details
 */
export async function get(activityId, userId) {
  const activity = await activityQueries.findById(activityId);

  if (!activity) {
    throw new NotFoundError('Activity');
  }

  // Verify user has access to the trip
  const hasAccess = await checkAccess(activity.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this activity');
  }

  return formatActivity(activity);
}

/**
 * Update an activity
 * @param {string} activityId - Activity ID
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated activity
 */
export async function update(activityId, userId, updates) {
  // Verify access
  const activity = await activityQueries.findById(activityId);
  if (!activity) {
    throw new NotFoundError('Activity');
  }

  const canEdit = await checkPermission(activity.trip_id, userId, ['owner', 'editor']);
  if (!canEdit) {
    throw new AuthorizationError('You do not have permission to update this activity');
  }

  // Validate updates
  if (updates.type && !isValidActivityType(updates.type)) {
    throw new ValidationError('Activity type must be a valid default type or a custom category reference (custom:uuid)');
  }

  if (updates.title !== undefined && updates.title.trim().length === 0) {
    throw new ValidationError('Activity title cannot be empty');
  }

  if (updates.startTime && updates.endTime) {
    const start = new Date(updates.startTime);
    const end = new Date(updates.endTime);

    if (end < start) {
      throw new ValidationError('End time must be after start time');
    }
  }

  // Validate activity dates are within trip date range
  if (updates.startTime || updates.endTime) {
    const trip = await tripQueries.findById(activity.trip_id);
    if (trip) {
      if (updates.startTime) {
        const activityStartDate = new Date(updates.startTime).toISOString().split('T')[0];
        if (trip.start_date) {
          const tripStartDate = new Date(trip.start_date).toISOString().split('T')[0];
          if (activityStartDate < tripStartDate) {
            throw new ValidationError('Activity start time must be on or after the trip start date');
          }
        }
        if (trip.end_date) {
          const tripEndDate = new Date(trip.end_date).toISOString().split('T')[0];
          if (activityStartDate > tripEndDate) {
            throw new ValidationError('Activity start time must be on or before the trip end date');
          }
        }
      }

      if (updates.endTime) {
        const activityEndDate = new Date(updates.endTime).toISOString().split('T')[0];
        if (trip.start_date) {
          const tripStartDate = new Date(trip.start_date).toISOString().split('T')[0];
          if (activityEndDate < tripStartDate) {
            throw new ValidationError('Activity end time must be on or after the trip start date');
          }
        }
        if (trip.end_date) {
          const tripEndDate = new Date(trip.end_date).toISOString().split('T')[0];
          if (activityEndDate > tripEndDate) {
            throw new ValidationError('Activity end time must be on or before the trip end date');
          }
        }
      }
    }
  }

  // Update activity
  const updatedActivity = await activityQueries.update(activityId, updates, userId); // T150: Track who updated
  return formatActivity(updatedActivity);
}

/**
 * Delete an activity
 * @param {string} activityId - Activity ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteActivity(activityId, userId) {
  // Verify access
  const activity = await activityQueries.findById(activityId);
  if (!activity) {
    throw new NotFoundError('Activity');
  }

  const canEdit = await checkPermission(activity.trip_id, userId, ['owner', 'editor']);
  if (!canEdit) {
    throw new AuthorizationError('You do not have permission to delete this activity');
  }

  await activityQueries.deleteActivity(activityId);
}

/**
 * Reorder activities for a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @param {Array<{id: string, orderIndex: number}>} orderUpdates - New order
 * @returns {Promise<Array>} Updated activities
 */
export async function reorder(tripId, userId, orderUpdates) {
  // Verify trip access
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  const canEdit = await checkPermission(tripId, userId, ['owner', 'editor']);
  if (!canEdit) {
    throw new AuthorizationError('You do not have permission to reorder activities');
  }

  // Validate order updates
  if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
    throw new ValidationError('Order updates must be a non-empty array');
  }

  const updatedActivities = await activityQueries.reorder(tripId, orderUpdates);
  return updatedActivities.map(formatActivity);
}

/**
 * Format activity for API response
 * @param {Object} activity - Database activity object
 * @returns {Object} Formatted activity
 */
function formatActivity(activity) {
  return {
    id: activity.id,
    tripId: activity.trip_id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    location: activity.location,
    latitude: activity.latitude ? parseFloat(activity.latitude) : null,
    longitude: activity.longitude ? parseFloat(activity.longitude) : null,
    startTime: activity.start_time,
    endTime: activity.end_time,
    orderIndex: activity.order_index,
    metadata: activity.metadata,
    createdAt: activity.created_at,
    updatedAt: activity.updated_at,
    // T150: Include attribution fields
    createdBy: activity.created_by,
    createdByName: activity.created_by_name,
    createdByEmail: activity.created_by_email,
    updatedBy: activity.updated_by,
    updatedByName: activity.updated_by_name,
    updatedByEmail: activity.updated_by_email,
  };
}
