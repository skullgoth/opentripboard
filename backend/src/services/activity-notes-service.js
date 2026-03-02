// Activity notes service - CRUD with access control
import * as activityNoteQueries from '../db/queries/activity-notes.js';
import * as activityQueries from '../db/queries/activities.js';
import { checkAccess } from './trip-buddy-service.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';

const MAX_NOTE_LENGTH = 2000;

/**
 * Create a new activity note
 * @param {string} tripId - Trip ID
 * @param {string} activityId - Activity ID
 * @param {string} userId - Author user ID
 * @param {string} content - Note content
 * @returns {Promise<Object>} Created note
 */
export async function create(tripId, activityId, userId, content) {
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const activity = await activityQueries.findById(activityId);
  if (!activity) {
    throw new NotFoundError('Activity');
  }

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Note content is required');
  }

  if (content.length > MAX_NOTE_LENGTH) {
    throw new ValidationError(`Note content must be ${MAX_NOTE_LENGTH} characters or less`);
  }

  return activityNoteQueries.create({
    activityId,
    tripId,
    authorId: userId,
    content: content.trim(),
  });
}

/**
 * List notes for an activity
 * @param {string} tripId - Trip ID
 * @param {string} activityId - Activity ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Array>} Notes array
 */
export async function listByActivity(tripId, activityId, userId) {
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  return activityNoteQueries.findByActivityId(activityId);
}

/**
 * Update a note
 * @param {string} noteId - Note ID
 * @param {string} userId - Requesting user ID
 * @param {string} content - New content
 * @returns {Promise<Object>} Updated note
 */
export async function update(noteId, userId, content) {
  const note = await activityNoteQueries.findById(noteId);
  if (!note) {
    throw new NotFoundError('Note');
  }

  // Only author can edit their own notes
  if (note.authorId !== userId) {
    throw new AuthorizationError('You can only edit your own notes');
  }

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Note content is required');
  }

  if (content.length > MAX_NOTE_LENGTH) {
    throw new ValidationError(`Note content must be ${MAX_NOTE_LENGTH} characters or less`);
  }

  return activityNoteQueries.update(noteId, content.trim());
}

/**
 * Delete a note
 * @param {string} tripId - Trip ID
 * @param {string} noteId - Note ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<void>}
 */
export async function deleteNote(tripId, noteId, userId) {
  const note = await activityNoteQueries.findById(noteId);
  if (!note) {
    throw new NotFoundError('Note');
  }

  // Author can delete their own notes, or trip member with access can delete
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  if (note.authorId !== userId) {
    throw new AuthorizationError('You can only delete your own notes');
  }

  await activityNoteQueries.deleteNote(noteId);
}
