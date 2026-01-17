/**
 * T093: TripBuddyService - manage trip buddies and permissions
 */
import * as tripBuddyQueries from '../db/queries/trip-buddies.js';
import * as tripQueries from '../db/queries/trips.js';
import * as userQueries from '../db/queries/users.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';

/**
 * Invite a tripBuddy to a trip
 * @param {string} tripId - Trip UUID
 * @param {string} invitedByUserId - User UUID who is inviting
 * @param {string} inviteeEmail - Email of user to invite
 * @param {string} role - Role to assign ('editor' | 'viewer')
 * @returns {Promise<Object>} Created tripBuddy record
 */
export async function inviteTripBuddy(tripId, invitedByUserId, inviteeEmail, role) {
  // Validate role
  if (!['editor', 'viewer'].includes(role)) {
    throw new ValidationError('Role must be either "editor" or "viewer"');
  }

  // Check if trip exists
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  // Check if inviting user has permission (must be owner or editor)
  const hasPermission = await checkPermission(tripId, invitedByUserId, ['owner', 'editor']);
  if (!hasPermission) {
    throw new AuthorizationError('You do not have permission to invite trip buddies');
  }

  // Find user by email
  const invitee = await userQueries.findByEmail(inviteeEmail);
  if (!invitee) {
    throw new NotFoundError('User with that email not found');
  }

  // Check if user is the owner
  if (trip.owner_id === invitee.id) {
    throw new ValidationError('Cannot add trip owner as tripBuddy');
  }

  // Check if already a tripBuddy
  const existing = await tripBuddyQueries.findByTripAndUser(tripId, invitee.id);
  if (existing) {
    throw new ValidationError('User is already a tripBuddy on this trip');
  }

  // Create invitation
  const tripBuddy = await tripBuddyQueries.invite(tripId, invitee.id, role, invitedByUserId);

  return formatTripBuddy(tripBuddy);
}

/**
 * Accept a tripBuddy invitation
 * @param {string} tripBuddyId - TripBuddy UUID
 * @param {string} userId - User UUID accepting
 * @returns {Promise<Object>} Updated tripBuddy record
 */
export async function acceptInvitation(tripBuddyId, userId) {
  const tripBuddy = await tripBuddyQueries.findById(tripBuddyId);

  if (!tripBuddy) {
    throw new NotFoundError('Invitation not found');
  }

  // Verify user is the invited person
  if (tripBuddy.user_id !== userId) {
    throw new AuthorizationError('You cannot accept this invitation');
  }

  // Check if already accepted
  if (tripBuddy.accepted_at) {
    throw new ValidationError('Invitation already accepted');
  }

  const updated = await tripBuddyQueries.markAsAccepted(tripBuddyId);
  return formatTripBuddy(updated);
}

/**
 * Get all trip buddies for a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Array>} Array of trip buddies
 */
export async function getTripBuddies(tripId, userId) {
  // Verify user has access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const tripBuddies = await tripBuddyQueries.findByTripId(tripId);
  return tripBuddies.map(formatTripBuddy);
}

/**
 * Get pending invitations for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of pending invitations
 */
export async function getPendingInvitations(userId) {
  const invitations = await tripBuddyQueries.findPendingInvitations(userId);
  return invitations.map(formatTripBuddy);
}

/**
 * Update tripBuddy role
 * @param {string} tripBuddyId - TripBuddy UUID
 * @param {string} userId - User making the change
 * @param {string} newRole - New role ('editor' | 'viewer')
 * @returns {Promise<Object>} Updated tripBuddy
 */
export async function updateRole(tripBuddyId, userId, newRole) {
  // Validate role
  if (!['editor', 'viewer'].includes(newRole)) {
    throw new ValidationError('Role must be either "editor" or "viewer"');
  }

  const tripBuddy = await tripBuddyQueries.findById(tripBuddyId);
  if (!tripBuddy) {
    throw new NotFoundError('TripBuddy');
  }

  // Check if user has permission (must be owner or editor)
  const hasPermission = await checkPermission(tripBuddy.trip_id, userId, ['owner', 'editor']);
  if (!hasPermission) {
    throw new AuthorizationError('You do not have permission to update tripBuddy roles');
  }

  const updated = await tripBuddyQueries.updateRole(tripBuddyId, newRole);
  return formatTripBuddy(updated);
}

/**
 * Remove a tripBuddy from a trip
 * @param {string} tripBuddyId - TripBuddy UUID
 * @param {string} userId - User making the change
 * @returns {Promise<void>}
 */
export async function removeTripBuddy(tripBuddyId, userId) {
  const tripBuddy = await tripBuddyQueries.findById(tripBuddyId);
  if (!tripBuddy) {
    throw new NotFoundError('TripBuddy');
  }

  // User can remove themselves, or owner/editor can remove others
  const isSelf = tripBuddy.user_id === userId;
  const hasPermission = await checkPermission(tripBuddy.trip_id, userId, ['owner', 'editor']);

  if (!isSelf && !hasPermission) {
    throw new AuthorizationError('You do not have permission to remove this tripBuddy');
  }

  await tripBuddyQueries.remove(tripBuddyId);
}

/**
 * Leave a trip (remove self as tripBuddy)
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User leaving
 * @returns {Promise<void>}
 */
export async function leaveTrip(tripId, userId) {
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);

  if (!tripBuddy) {
    throw new NotFoundError('You are not a tripBuddy on this trip');
  }

  await tripBuddyQueries.remove(tripBuddy.id);
}

/**
 * Check if user has access to a trip (owner or tripBuddy)
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>} True if user has access
 */
export async function checkAccess(tripId, userId) {
  // Check if owner
  const trip = await tripQueries.findById(tripId);
  if (trip && trip.owner_id === userId) {
    return true;
  }

  // Check if tripBuddy with accepted invitation
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);
  return !!(tripBuddy && tripBuddy.accepted_at);
}

/**
 * Check if user has specific permission level
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @param {Array<string>} allowedRoles - Allowed roles (['owner', 'editor', 'viewer'])
 * @returns {Promise<boolean>} True if user has permission
 */
export async function checkPermission(tripId, userId, allowedRoles) {
  // Check if owner
  const trip = await tripQueries.findById(tripId);
  if (trip && trip.owner_id === userId) {
    return allowedRoles.includes('owner');
  }

  // Check tripBuddy role
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);
  if (!tripBuddy || !tripBuddy.accepted_at) {
    return false;
  }

  return allowedRoles.includes(tripBuddy.role);
}

/**
 * Get user's role on a trip
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @returns {Promise<string|null>} Role or null if no access
 */
export async function getUserRole(tripId, userId) {
  // Check if owner
  const trip = await tripQueries.findById(tripId);
  if (trip && trip.owner_id === userId) {
    return 'owner';
  }

  // Check tripBuddy
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);
  if (tripBuddy && tripBuddy.accepted_at) {
    return tripBuddy.role;
  }

  return null;
}

/**
 * Get trip tripBuddy statistics
 * @param {string} tripId - Trip UUID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} TripBuddy stats
 */
export async function getTripBuddyStats(tripId, userId) {
  // Verify access
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const totalCount = await tripBuddyQueries.countByTripId(tripId);
  const allTripBuddies = await tripBuddyQueries.findByTripId(tripId);

  const acceptedCount = allTripBuddies.filter(c => c.accepted_at).length;
  const pendingCount = allTripBuddies.filter(c => !c.accepted_at).length;

  return {
    total: totalCount,
    accepted: acceptedCount,
    pending: pendingCount,
  };
}

/**
 * Format tripBuddy for API response
 * @param {Object} tripBuddy - Database tripBuddy object
 * @returns {Object} Formatted tripBuddy
 */
function formatTripBuddy(tripBuddy) {
  return {
    id: tripBuddy.id,
    tripId: tripBuddy.trip_id,
    userId: tripBuddy.user_id,
    role: tripBuddy.role,
    invitedBy: tripBuddy.invited_by,
    invitedAt: tripBuddy.invited_at,
    acceptedAt: tripBuddy.accepted_at,
    createdAt: tripBuddy.created_at,
    updatedAt: tripBuddy.updated_at,
    // User details if available
    email: tripBuddy.email,
    fullName: tripBuddy.full_name,
    profilePictureUrl: tripBuddy.profile_picture_url,
    // Trip details if available
    tripName: tripBuddy.trip_name,
    destination: tripBuddy.destination,
    startDate: tripBuddy.start_date,
    endDate: tripBuddy.end_date,
    ownerName: tripBuddy.owner_name,
    invitedByName: tripBuddy.invited_by_name,
  };
}
