/**
 * T094: SuggestionService - manage activity suggestions and voting
 */
import * as suggestionQueries from '../db/queries/suggestions.js';
import * as activityQueries from '../db/queries/activities.js';
import * as tripQueries from '../db/queries/trips.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';
import { checkAccess, checkPermission } from './trip-buddy-service.js';

/**
 * Create a new suggestion
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User creating suggestion
 * @param {Object} suggestionData - Suggestion data
 * @returns {Promise<Object>} Created suggestion
 */
export async function createSuggestion(tripId, userId, suggestionData) {
  const {
    activityType,
    title,
    description,
    location,
    latitude,
    longitude,
    startTime,
    endTime,
  } = suggestionData;

  // Validate required fields
  if (!title || title.trim().length === 0) {
    throw new ValidationError('Suggestion title is required');
  }

  if (!activityType) {
    throw new ValidationError('Activity type is required');
  }

  // Validate activity type
  // All valid activity/reservation types
  const validTypes = [
    // Lodging
    'hotel', 'rental',
    // Transport
    'bus', 'car', 'cruise', 'ferry', 'flight', 'train',
    // Dining
    'bar', 'restaurant',
    // Activities
    'market', 'monument', 'museum', 'park', 'shopping', 'sightseeing',
    // Legacy types
    'accommodation', 'transportation', 'attraction', 'meeting', 'event', 'other',
  ];
  if (!validTypes.includes(activityType)) {
    throw new ValidationError(`Activity type must be one of: ${validTypes.join(', ')}`);
  }

  // Check if user has access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  // Fetch trip for access control
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  // Note: Date range validation (within trip dates) is enforced by frontend HTML min/max attributes
  // Backend skips this validation to avoid timezone conversion issues with ISO dates

  // Validate time range
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end < start) {
      throw new ValidationError('End time must be after start time');
    }
  }

  // Validate coordinates
  if ((latitude && !longitude) || (!latitude && longitude)) {
    throw new ValidationError('Both latitude and longitude must be provided together');
  }

  if (latitude !== undefined && longitude !== undefined) {
    if (latitude < -90 || latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }
    if (longitude < -180 || longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }
  }

  // Check for duplicate suggestion
  const existing = await suggestionQueries.findSimilar(tripId, userId, title);
  if (existing) {
    throw new ValidationError('You have already suggested a similar activity');
  }

  // Create suggestion
  const suggestion = await suggestionQueries.create({
    tripId,
    suggestedByUserId: userId,
    activityType,
    title: title.trim(),
    description: description?.trim() || null,
    location: location?.trim() || null,
    latitude: latitude || null,
    longitude: longitude || null,
    startTime: startTime || null,
    endTime: endTime || null,
  });

  return formatSuggestion(suggestion);
}

/**
 * Get all suggestions for a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - Requesting user ID
 * @param {string} status - Optional filter by status
 * @returns {Promise<Array>} Array of suggestions
 */
export async function getSuggestions(tripId, userId, status = null) {
  // Verify user has access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const suggestions = await suggestionQueries.findByTripId(tripId, status);

  // Add vote summaries
  const suggestionsWithVotes = await Promise.all(
    suggestions.map(async (suggestion) => {
      const voteSummary = await suggestionQueries.getVoteSummary(suggestion.id);
      return {
        ...formatSuggestion(suggestion),
        upvotes: voteSummary?.upvotes || 0,
        downvotes: voteSummary?.downvotes || 0,
        totalVotes: voteSummary?.total_votes || 0,
      };
    })
  );

  return suggestionsWithVotes;
}

/**
 * Get a specific suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Suggestion details
 */
export async function getSuggestion(suggestionId, userId) {
  const suggestion = await suggestionQueries.findById(suggestionId);

  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // Verify user has access to trip
  const hasAccess = await checkAccess(suggestion.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this suggestion');
  }

  const voteSummary = await suggestionQueries.getVoteSummary(suggestionId);

  return {
    ...formatSuggestion(suggestion),
    upvotes: voteSummary?.upvotes || 0,
    downvotes: voteSummary?.downvotes || 0,
    totalVotes: voteSummary?.total_votes || 0,
  };
}

/**
 * Vote on a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User voting
 * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
 * @returns {Promise<Object>} Updated suggestion with vote summary
 */
export async function voteSuggestion(suggestionId, userId, vote) {
  // Validate vote type
  if (!['up', 'down', 'neutral'].includes(vote)) {
    throw new ValidationError('Vote must be "up", "down", or "neutral"');
  }

  const suggestion = await suggestionQueries.findById(suggestionId);
  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // Check if suggestion is still pending
  if (suggestion.status !== 'pending') {
    throw new ValidationError('Can only vote on pending suggestions');
  }

  // Verify user has access to trip
  const hasAccess = await checkAccess(suggestion.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  // Add or update vote
  const updated = await suggestionQueries.addVote(suggestionId, userId, vote);
  const voteSummary = await suggestionQueries.getVoteSummary(suggestionId);

  return {
    ...formatSuggestion(updated),
    upvotes: voteSummary?.upvotes || 0,
    downvotes: voteSummary?.downvotes || 0,
    totalVotes: voteSummary?.total_votes || 0,
  };
}

/**
 * Accept a suggestion (creates activity and marks as accepted)
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User accepting
 * @returns {Promise<Object>} Created activity and updated suggestion
 */
export async function acceptSuggestion(suggestionId, userId) {
  const suggestion = await suggestionQueries.findById(suggestionId);
  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // Check if suggestion is still pending
  if (suggestion.status !== 'pending') {
    throw new ValidationError('Suggestion has already been resolved');
  }

  // Verify user has permission (must be owner or editor)
  const hasPermission = await checkPermission(suggestion.trip_id, userId, ['owner', 'editor']);
  if (!hasPermission) {
    throw new AuthorizationError('You do not have permission to accept suggestions');
  }

  // Create activity from suggestion
  const activity = await activityQueries.create({
    tripId: suggestion.trip_id,
    type: suggestion.activity_type,
    title: suggestion.title,
    description: suggestion.description,
    location: suggestion.location,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    startTime: suggestion.start_time,
    endTime: suggestion.end_time,
    orderIndex: 0, // Will be reordered by frontend
    metadata: {
      fromSuggestion: suggestionId,
      suggestedBy: suggestion.suggested_by_user_id,
    },
  });

  // Mark suggestion as accepted
  const updatedSuggestion = await suggestionQueries.accept(suggestionId, userId);

  return {
    activity: formatActivity(activity),
    suggestion: formatSuggestion(updatedSuggestion),
  };
}

/**
 * Reject a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User rejecting
 * @returns {Promise<Object>} Updated suggestion
 */
export async function rejectSuggestion(suggestionId, userId) {
  const suggestion = await suggestionQueries.findById(suggestionId);
  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // Check if suggestion is still pending
  if (suggestion.status !== 'pending') {
    throw new ValidationError('Suggestion has already been resolved');
  }

  // Verify user has permission (must be owner or editor)
  const hasPermission = await checkPermission(suggestion.trip_id, userId, ['owner', 'editor']);
  if (!hasPermission) {
    throw new AuthorizationError('You do not have permission to reject suggestions');
  }

  const updated = await suggestionQueries.reject(suggestionId, userId);
  return formatSuggestion(updated);
}

/**
 * Update a suggestion (only by creator and if still pending)
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User updating
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated suggestion
 */
export async function updateSuggestion(suggestionId, userId, updates) {
  const suggestion = await suggestionQueries.findById(suggestionId);
  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // Only creator can update their suggestion
  if (suggestion.suggested_by_user_id !== userId) {
    throw new AuthorizationError('You can only update your own suggestions');
  }

  // Can only update pending suggestions
  if (suggestion.status !== 'pending') {
    throw new ValidationError('Can only update pending suggestions');
  }

  // Validate updates
  if (updates.title !== undefined && updates.title.trim().length === 0) {
    throw new ValidationError('Suggestion title cannot be empty');
  }

  // Note: Date range validation (within trip dates) is enforced by frontend HTML min/max attributes
  // Backend skips this validation to avoid timezone conversion issues with ISO dates

  if (updates.startTime && updates.endTime) {
    const start = new Date(updates.startTime);
    const end = new Date(updates.endTime);

    if (end < start) {
      throw new ValidationError('End time must be after start time');
    }
  }

  const updated = await suggestionQueries.update(suggestionId, updates);
  return formatSuggestion(updated);
}

/**
 * Delete a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User deleting
 * @returns {Promise<void>}
 */
export async function deleteSuggestion(suggestionId, userId) {
  const suggestion = await suggestionQueries.findById(suggestionId);
  if (!suggestion) {
    throw new NotFoundError('Suggestion');
  }

  // User can delete their own suggestion, or owner/editor can delete any
  const isSelf = suggestion.suggested_by_user_id === userId;
  const hasPermission = await checkPermission(suggestion.trip_id, userId, ['owner', 'editor']);

  if (!isSelf && !hasPermission) {
    throw new AuthorizationError('You do not have permission to delete this suggestion');
  }

  await suggestionQueries.remove(suggestionId);
}

/**
 * Get suggestion statistics for a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Suggestion statistics
 */
export async function getSuggestionStats(tripId, userId) {
  // Verify user has access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const allSuggestions = await suggestionQueries.findByTripId(tripId);
  const pending = allSuggestions.filter(s => s.status === 'pending').length;
  const accepted = allSuggestions.filter(s => s.status === 'accepted').length;
  const rejected = allSuggestions.filter(s => s.status === 'rejected').length;

  return {
    total: allSuggestions.length,
    pending,
    accepted,
    rejected,
  };
}

/**
 * Format suggestion for API response
 * @param {Object} suggestion - Database suggestion object
 * @returns {Object} Formatted suggestion
 */
function formatSuggestion(suggestion) {
  return {
    id: suggestion.id,
    tripId: suggestion.trip_id,
    suggestedByUserId: suggestion.suggested_by_user_id,
    activityType: suggestion.activity_type,
    title: suggestion.title,
    description: suggestion.description,
    location: suggestion.location,
    latitude: suggestion.latitude ? parseFloat(suggestion.latitude) : null,
    longitude: suggestion.longitude ? parseFloat(suggestion.longitude) : null,
    startTime: suggestion.start_time,
    endTime: suggestion.end_time,
    votes: suggestion.votes || [],
    status: suggestion.status,
    resolvedAt: suggestion.resolved_at,
    resolvedBy: suggestion.resolved_by,
    createdAt: suggestion.created_at,
    updatedAt: suggestion.updated_at,
    // User details if available
    suggestedByEmail: suggestion.suggested_by_email,
    suggestedByName: suggestion.suggested_by_name,
    suggestedByPicture: suggestion.suggested_by_picture,
    // Trip details if available
    tripName: suggestion.trip_name,
    destination: suggestion.destination,
  };
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
  };
}
