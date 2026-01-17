// T040: WebSocket message handler dispatcher
import logger from '../utils/logger.js';
import { broadcastToRoom } from './rooms.js';
import * as activityService from '../services/activity-service.js';

/**
 * Message handlers for different WebSocket message types
 */
const handlers = new Map();

/**
 * Register a message handler
 * @param {string} messageType - Message type to handle
 * @param {Function} handler - Handler function (message, context) => void
 */
export function registerHandler(messageType, handler) {
  handlers.set(messageType, handler);
}

/**
 * Handle incoming WebSocket message
 * @param {Object} message - Parsed message object
 * @param {Object} context - Context object with userId, tripId, socket
 */
export async function handleMessage(message, context) {
  const { type } = message;

  if (!type) {
    context.socket.send(JSON.stringify({
      type: 'error',
      message: 'Message type is required',
    }));
    return;
  }

  const handler = handlers.get(type);

  if (!handler) {
    // Default behavior: broadcast unknown messages to room
    logger.debug('Unknown message type, broadcasting to room', { type });

    broadcastToRoom(
      context.tripId,
      {
        ...message,
        userId: context.userId,
        timestamp: new Date().toISOString(),
      },
      context.userId // Exclude sender
    );

    return;
  }

  try {
    await handler(message, context);
  } catch (error) {
    logger.error('Error handling message type', { type, error });
    context.socket.send(JSON.stringify({
      type: 'error',
      message: `Failed to handle ${type}`,
    }));
  }
}

// Register default handlers for common message types

/**
 * Activity created - broadcast to room
 */
registerHandler('activity:created', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'activity:created',
      activity: message.activity,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Activity updated - fetch updated activity and broadcast to room
 */
registerHandler('activity:updated', async (message, context) => {
  try {
    // Fetch the updated activity from the database
    const activity = await activityService.get(message.activityId, context.userId);

    broadcastToRoom(
      context.tripId,
      {
        type: 'activity:updated',
        activityId: message.activityId,
        activity, // Include full activity object
        userId: context.userId,
        timestamp: new Date().toISOString(),
      },
      context.userId
    );
  } catch (error) {
    logger.error('Failed to fetch activity for broadcast:', {
      activityId: message.activityId,
      error: error.message,
    });
  }
});

/**
 * Activity deleted - broadcast to room
 */
registerHandler('activity:deleted', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'activity:deleted',
      activityId: message.activityId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Activity reordered - broadcast to room
 */
registerHandler('activity:reordered', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'activity:reordered',
      activities: message.activities,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Suggestion created - broadcast to room
 */
registerHandler('suggestion:created', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'suggestion:created',
      suggestion: message.suggestion,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Suggestion voted - broadcast to room
 */
registerHandler('suggestion:voted', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'suggestion:voted',
      suggestionId: message.suggestionId,
      vote: message.vote,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Typing indicator - broadcast to room
 */
registerHandler('typing:start', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'typing:start',
      userId: context.userId,
      location: message.location,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

registerHandler('typing:stop', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'typing:stop',
      userId: context.userId,
      location: message.location,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});

/**
 * Cursor position (for collaborative editing) - broadcast to room
 */
registerHandler('cursor:move', async (message, context) => {
  broadcastToRoom(
    context.tripId,
    {
      type: 'cursor:move',
      userId: context.userId,
      position: message.position,
      timestamp: new Date().toISOString(),
    },
    context.userId
  );
});
