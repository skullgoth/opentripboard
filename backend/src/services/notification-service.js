// Notification service - creates notifications and pushes via WebSocket
import * as notificationQueries from '../db/queries/notifications.js';
import * as tripBuddyQueries from '../db/queries/trip-buddies.js';
import * as tripQueries from '../db/queries/trips.js';
import { sendToUserGlobal } from '../websocket/rooms.js';
import logger from '../utils/logger.js';

/**
 * Get all trip participants (accepted buddies + owner), excluding the actor
 * @param {string} tripId - Trip ID
 * @param {string} excludeUserId - User ID to exclude (the actor)
 * @returns {Promise<string[]>} Array of user IDs
 */
async function getTripRecipients(tripId, excludeUserId) {
  const [buddies, trip] = await Promise.all([
    tripBuddyQueries.findByTripId(tripId),
    tripQueries.findById(tripId),
  ]);

  if (!trip) return [];

  const recipientIds = new Set();

  // Add trip owner
  recipientIds.add(trip.owner_id);

  // Add accepted buddies
  for (const buddy of buddies) {
    if (buddy.accepted_at) {
      recipientIds.add(buddy.user_id);
    }
  }

  // Remove the actor
  recipientIds.delete(excludeUserId);

  return Array.from(recipientIds);
}

/**
 * Notify all trip participants (except the actor)
 * @param {string} tripId - Trip ID
 * @param {string} actorId - User who performed the action
 * @param {Object} data - Notification data (type, title, message, entityId, entityType)
 */
export async function notifyTripParticipants(tripId, actorId, data) {
  try {
    const recipients = await getTripRecipients(tripId, actorId);

    for (const userId of recipients) {
      const notification = await notificationQueries.create({
        userId,
        tripId,
        actorId,
        ...data,
      });

      sendToUserGlobal(userId, {
        type: 'notification:new',
        notification,
      });
    }
  } catch (error) {
    logger.error('Failed to send notifications', { tripId, actorId, error });
  }
}

/**
 * Notify that a buddy joined a trip
 * @param {string} tripId - Trip ID
 * @param {string} actorId - The user who accepted the invitation
 * @param {string} actorName - Name of the user
 * @param {string} tripName - Name of the trip
 */
export async function notifyBuddyJoined(tripId, actorId, actorName, tripName) {
  await notifyTripParticipants(tripId, actorId, {
    type: 'buddy_joined',
    title: `${actorName} joined ${tripName}`,
  });
}

/**
 * Notify that a suggestion was voted on
 * @param {string} tripId - Trip ID
 * @param {string} actorId - The user who voted
 * @param {string} actorName - Name of the user
 * @param {string} suggestionTitle - Title of the suggestion
 * @param {string} vote - Vote type (up/down/neutral)
 * @param {string} suggestionId - Suggestion ID
 */
export async function notifySuggestionVoted(tripId, actorId, actorName, suggestionTitle, vote, suggestionId) {
  await notifyTripParticipants(tripId, actorId, {
    type: 'suggestion_voted',
    title: `${actorName} voted on "${suggestionTitle}"`,
    entityId: suggestionId,
    entityType: 'suggestion',
  });
}

/**
 * Notify that an expense was created
 * @param {string} tripId - Trip ID
 * @param {string} actorId - The user who created the expense
 * @param {string} actorName - Name of the user
 * @param {Object} expense - Expense data
 */
export async function notifyExpenseCreated(tripId, actorId, actorName, expense) {
  const description = expense.description || expense.category;
  await notifyTripParticipants(tripId, actorId, {
    type: 'expense_created',
    title: `${actorName} added an expense: ${description}`,
    entityId: expense.id,
    entityType: 'expense',
  });
}

/**
 * Notify that a list item was completed
 * @param {string} tripId - Trip ID
 * @param {string} actorId - The user who checked the item
 * @param {string} actorName - Name of the user
 * @param {string} itemText - Text of the completed item
 * @param {string} listId - List ID
 */
export async function notifyListItemCompleted(tripId, actorId, actorName, itemText, listId) {
  await notifyTripParticipants(tripId, actorId, {
    type: 'list_item_completed',
    title: `${actorName} completed "${itemText}"`,
    entityId: listId,
    entityType: 'list',
  });
}
