// T065: TripService - trip CRUD and validation
import * as tripQueries from '../db/queries/trips.js';
import * as activityQueries from '../db/queries/activities.js';
import * as listQueries from '../db/queries/lists.js';
import { checkAccess } from './trip-buddy-service.js';
import { query } from '../db/connection.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';
import { getGeocodingService } from './geocoding-service.js';
import { getCoverImageService } from './cover-image-service.js';

/**
 * T013: Validate destination_data structure
 * @param {Object} destinationData - Destination metadata from Nominatim
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If invalid
 */
function validateDestinationData(destinationData) {
  if (!destinationData) {
    return true; // destinationData is optional (null allowed)
  }

  const geocodingService = getGeocodingService();

  if (!geocodingService.validateDestinationData(destinationData)) {
    throw new ValidationError(
      'Invalid destination data structure. Must include place_id, display_name, lat, lon, and validated flag.'
    );
  }

  return true;
}

/**
 * T028: Validate cover_image_attribution structure
 * @param {Object} attribution - Cover image attribution metadata
 * @returns {boolean} - True if valid
 * @throws {ValidationError} - If invalid
 */
function validateCoverImageAttribution(attribution) {
  if (!attribution) {
    return true; // attribution is optional (null allowed)
  }

  if (typeof attribution !== 'object') {
    throw new ValidationError('Cover image attribution must be an object');
  }

  const required = ['source'];
  for (const field of required) {
    if (!(field in attribution)) {
      throw new ValidationError(`Cover image attribution missing required field: ${field}`);
    }
  }

  // Validate source type
  const validSources = ['pexels', 'user_upload', 'placeholder'];
  if (!validSources.includes(attribution.source)) {
    throw new ValidationError(`Invalid attribution source: ${attribution.source}. Must be one of: ${validSources.join(', ')}`);
  }

  // Validate Pexels attribution structure
  if (attribution.source === 'pexels') {
    const pexelsRequired = ['photographer', 'photographerUrl', 'photoUrl', 'photoId'];
    for (const field of pexelsRequired) {
      if (!(field in attribution)) {
        throw new ValidationError(`Pexels attribution missing required field: ${field}`);
      }
    }
  }

  return true;
}

/**
 * Create a new trip
 * @param {string} userId - Owner user ID
 * @param {Object} tripData - Trip data
 * @returns {Promise<Object>} Created trip
 */
export async function create(userId, tripData) {
  const {
    name,
    destination,
    startDate,
    endDate,
    budget,
    currency,
    timezone,
    description,
    destinationData, // T013: New - validated destination metadata
    coverImageAttribution, // T013: New - Pexels attribution metadata (for later use)
  } = tripData;

  // Validate required fields
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Trip name is required');
  }

  // Validate date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new ValidationError('End date must be after start date');
    }
  }

  // Validate budget
  if (budget !== undefined && budget < 0) {
    throw new ValidationError('Budget must be a positive number');
  }

  // T013: Validate destination data if provided
  if (destinationData) {
    validateDestinationData(destinationData);
  }

  // T028: Validate cover image attribution if provided
  if (coverImageAttribution) {
    validateCoverImageAttribution(coverImageAttribution);
  }

  // Create trip (initial creation without cover image)
  const trip = await tripQueries.create({
    ownerId: userId,
    name: name.trim(),
    destination: destination?.trim() || null,
    startDate: startDate || null,
    endDate: endDate || null,
    budget: budget || null,
    currency: currency || 'USD',
    timezone: timezone || 'UTC',
    description: description?.trim() || null,
    destinationData: destinationData || null, // T013: New field
    coverImageAttribution: coverImageAttribution || null, // T013: New field
  });

  // T027: Automatically fetch cover image if destination is available
  // Priority: 1) validated destinationData.display_name, 2) plain destination text
  const coverImageDestination = destinationData?.validated
    ? destinationData.display_name
    : destination?.trim();

  if (coverImageDestination) {
    try {
      const coverImageService = getCoverImageService();
      const coverResult = await coverImageService.fetchCoverImage(
        coverImageDestination,
        { tripId: trip.id }
      );

      // Update trip with cover image URL and attribution
      await query(
        `UPDATE trips
         SET cover_image_url = $1,
             cover_image_attribution = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [coverResult.url, coverResult.attribution, trip.id]
      );

      // Update local trip object
      trip.cover_image_url = coverResult.url;
      trip.cover_image_attribution = coverResult.attribution;
    } catch (error) {
      // T029: Fallback to placeholder on error (non-blocking)
      console.error(`Failed to fetch cover image for trip ${trip.id}:`, error.message);

      // Set placeholder attribution
      const placeholderAttribution = {
        source: 'placeholder',
        reason: error.message,
      };

      await query(
        `UPDATE trips
         SET cover_image_url = $1,
             cover_image_attribution = $2,
             updated_at = NOW()
         WHERE id = $3`,
        ['/images/placeholder-trip.svg', placeholderAttribution, trip.id]
      );

      trip.cover_image_url = '/images/placeholder-trip.svg';
      trip.cover_image_attribution = placeholderAttribution;
    }
  }

  return formatTrip(trip);
}

/**
 * Get trip by ID
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Trip details
 */
export async function get(tripId, userId) {
  const trip = await tripQueries.findById(tripId);

  if (!trip) {
    throw new NotFoundError('Trip');
  }

  // Check access: user must be owner or an accepted trip buddy
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  return formatTrip(trip);
}

/**
 * Get all trips for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of trips
 */
export async function listByUser(userId) {
  const trips = await tripQueries.findByUserId(userId);
  return trips.map(formatTrip);
}

/**
 * Update a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated trip
 */
export async function update(tripId, userId, updates) {
  // Verify ownership
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  if (trip.owner_id !== userId) {
    throw new AuthorizationError('Only trip owner can update trip details');
  }

  // Validate updates
  if (updates.name !== undefined && updates.name.trim().length === 0) {
    throw new ValidationError('Trip name cannot be empty');
  }

  if (updates.startDate && updates.endDate) {
    const start = new Date(updates.startDate);
    const end = new Date(updates.endDate);

    if (end < start) {
      throw new ValidationError('End date must be after start date');
    }
  }

  if (updates.budget !== undefined && updates.budget < 0) {
    throw new ValidationError('Budget must be a positive number');
  }

  // Update trip
  const updatedTrip = await tripQueries.update(tripId, updates);
  return formatTrip(updatedTrip);
}

/**
 * Delete a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<void>}
 */
export async function deleteTrip(tripId, userId) {
  // Verify ownership
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  if (trip.owner_id !== userId) {
    throw new AuthorizationError('Only trip owner can delete the trip');
  }

  await tripQueries.deleteTrip(tripId);
}

/**
 * Get trip statistics
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Trip statistics
 */
export async function getStatistics(tripId, userId) {
  // Verify access
  await get(tripId, userId);

  const stats = await tripQueries.getStatistics(tripId);
  return stats;
}

/**
 * Clone a trip with activities and lists
 * Deep-copies the trip structure with dates shifted to start from today.
 * Excludes: expenses, documents, buddies, suggestions, activity notes.
 * @param {string} tripId - Source trip ID
 * @param {string} userId - Requesting user ID (becomes owner of the clone)
 * @returns {Promise<Object>} Cloned trip
 */
export async function cloneTrip(tripId, userId) {
  // Verify access to source trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const sourceTripRaw = await tripQueries.findById(tripId);
  if (!sourceTripRaw) {
    throw new NotFoundError('Trip');
  }

  // Calculate date offset (in milliseconds)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let offsetMs = 0;
  if (sourceTripRaw.start_date) {
    const originalStart = new Date(sourceTripRaw.start_date);
    originalStart.setHours(0, 0, 0, 0);
    offsetMs = today.getTime() - originalStart.getTime();
  }

  // Shift a date/timestamp by the offset
  const shiftDate = (dateValue) => {
    if (!dateValue) return null;
    const d = new Date(dateValue);
    return new Date(d.getTime() + offsetMs).toISOString();
  };

  // Create the cloned trip
  const newTripData = {
    ownerId: userId,
    name: `Copy of ${sourceTripRaw.name}`,
    destination: sourceTripRaw.destination,
    startDate: sourceTripRaw.start_date ? shiftDate(sourceTripRaw.start_date) : null,
    endDate: sourceTripRaw.end_date ? shiftDate(sourceTripRaw.end_date) : null,
    budget: sourceTripRaw.budget ? parseFloat(sourceTripRaw.budget) : null,
    currency: sourceTripRaw.currency,
    timezone: sourceTripRaw.timezone,
    description: sourceTripRaw.description,
    destinationData: sourceTripRaw.destination_data || null,
    coverImageAttribution: sourceTripRaw.cover_image_attribution || null,
  };

  const newTripRaw = await tripQueries.create(newTripData);

  // Copy cover_image_url from source trip
  if (sourceTripRaw.cover_image_url) {
    await query(
      `UPDATE trips SET cover_image_url = $1, updated_at = NOW() WHERE id = $2`,
      [sourceTripRaw.cover_image_url, newTripRaw.id]
    );
    newTripRaw.cover_image_url = sourceTripRaw.cover_image_url;
  }

  // Clone activities
  const sourceActivities = await activityQueries.findByTripId(tripId);
  for (const activity of sourceActivities) {
    // Clean metadata: remove notes and attachments
    let cleanMetadata = activity.metadata ? { ...activity.metadata } : {};
    delete cleanMetadata.notes;
    delete cleanMetadata.attachments;

    await activityQueries.create({
      tripId: newTripRaw.id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      location: activity.location,
      latitude: activity.latitude,
      longitude: activity.longitude,
      startTime: shiftDate(activity.start_time),
      endTime: shiftDate(activity.end_time),
      orderIndex: activity.order_index,
      metadata: cleanMetadata,
      createdBy: userId,
    });
  }

  // Clone lists
  const sourceLists = await listQueries.findByTripId(tripId);
  for (const list of sourceLists) {
    // Uncheck all items
    const uncheckedItems = (list.items || []).map((item) => ({
      text: item.text,
      checked: false,
      order: item.order,
    }));

    await listQueries.create({
      tripId: newTripRaw.id,
      type: list.type,
      title: list.title,
      items: uncheckedItems,
      createdBy: userId,
    });
  }

  // Re-fetch the new trip with joined owner data
  const newTrip = await tripQueries.findById(newTripRaw.id);
  return formatTrip(newTrip);
}

/**
 * Format trip for API response
 * @param {Object} trip - Database trip object
 * @returns {Object} Formatted trip
 */
function formatTrip(trip) {
  return {
    id: trip.id,
    ownerId: trip.owner_id,
    ownerEmail: trip.owner_email || null,
    ownerName: trip.owner_name || null,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    budget: trip.budget ? parseFloat(trip.budget) : null,
    currency: trip.currency,
    timezone: trip.timezone,
    description: trip.description,
    coverImageUrl: trip.cover_image_url || null,
    destinationData: trip.destination_data || null, // T013: New field
    coverImageAttribution: trip.cover_image_attribution || null, // T013: New field
    createdAt: trip.created_at,
    updatedAt: trip.updated_at,
    userRole: trip.user_role || 'owner',
  };
}

/**
 * Update trip cover image URL
 * T092 & T093: Cover image management
 * T036/T037: Update attribution when user uploads custom image
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @param {string|null} coverImageUrl - Cover image URL (or null to remove)
 * @param {Object|null} attribution - Cover image attribution (optional)
 * @returns {Promise<Object>} Updated trip
 */
export async function updateCoverImage(tripId, userId, coverImageUrl, attribution = undefined) {
  // Verify ownership/access
  await get(tripId, userId);

  // T036: Determine final attribution
  let finalAttribution;
  if (coverImageUrl === null) {
    // When removing cover image, also clear attribution
    finalAttribution = null;
  } else if (attribution !== undefined) {
    // Use provided attribution
    finalAttribution = attribution;
  } else {
    // T036: Default to user_upload when no attribution provided
    finalAttribution = { source: 'user_upload' };
  }

  const result = await query(
    `UPDATE trips
     SET cover_image_url = $1,
         cover_image_attribution = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [coverImageUrl, finalAttribution, tripId]
  );

  if (result.rows.length === 0) {
    throw new Error('Trip not found');
  }

  return formatTrip(result.rows[0]);
}
