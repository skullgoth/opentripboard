// T039: WebSocket room manager - join/leave, broadcast
import logger from '../utils/logger.js';

/**
 * Room manager for WebSocket connections
 * Rooms are organized by tripId
 */

// Map of tripId -> Set of { userId, socket }
const rooms = new Map();

/**
 * Join a room
 * @param {string} tripId - Trip ID (room identifier)
 * @param {string} userId - User ID
 * @param {WebSocket} socket - WebSocket connection
 */
export function joinRoom(tripId, userId, socket) {
  if (!rooms.has(tripId)) {
    rooms.set(tripId, new Set());
  }

  const room = rooms.get(tripId);

  // Check if user already in room (reconnection)
  const existingConnection = Array.from(room).find(
    (conn) => conn.userId === userId
  );

  if (existingConnection) {
    // Remove old connection
    room.delete(existingConnection);
  }

  // Add new connection
  room.add({ userId, socket });

  logger.debug('User joined room', { userId, tripId, roomSize: room.size });

  return room.size;
}

/**
 * Leave a room
 * @param {string} tripId - Trip ID (room identifier)
 * @param {string} userId - User ID
 * @param {WebSocket} socket - WebSocket connection
 */
export function leaveRoom(tripId, userId, socket) {
  if (!rooms.has(tripId)) {
    return;
  }

  const room = rooms.get(tripId);

  // Find and remove the connection
  const connection = Array.from(room).find(
    (conn) => conn.userId === userId && conn.socket === socket
  );

  if (connection) {
    room.delete(connection);
    logger.debug('User left room', { userId, tripId, usersRemaining: room.size });
  }

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(tripId);
    logger.debug('Room deleted', { tripId });
  }
}

/**
 * Broadcast message to all users in a room
 * @param {string} tripId - Trip ID (room identifier)
 * @param {Object} message - Message to broadcast
 * @param {string} excludeUserId - Optional user ID to exclude from broadcast
 */
export function broadcastToRoom(tripId, message, excludeUserId = null) {
  if (!rooms.has(tripId)) {
    return;
  }

  const room = rooms.get(tripId);
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  for (const { userId, socket } of room) {
    // Skip excluded user (typically the sender)
    if (excludeUserId && userId === excludeUserId) {
      continue;
    }

    // Check if socket is still open
    if (socket.readyState === 1) { // 1 = OPEN
      try {
        socket.send(messageStr);
        sentCount++;
      } catch (error) {
        logger.error('Failed to send to user', { userId, error });
      }
    }
  }

  logger.debug('Broadcast to room', { tripId, recipientCount: sentCount });
}

/**
 * Send message to specific user in a room
 * @param {string} tripId - Trip ID (room identifier)
 * @param {string} userId - Target user ID
 * @param {Object} message - Message to send
 * @returns {boolean} True if message was sent
 */
export function sendToUser(tripId, userId, message) {
  if (!rooms.has(tripId)) {
    return false;
  }

  const room = rooms.get(tripId);
  const connection = Array.from(room).find(
    (conn) => conn.userId === userId
  );

  if (!connection) {
    return false;
  }

  if (connection.socket.readyState === 1) {
    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to send to user', { userId, error });
      return false;
    }
  }

  return false;
}

/**
 * Get list of users in a room
 * @param {string} tripId - Trip ID (room identifier)
 * @returns {string[]} Array of user IDs
 */
export function getRoomUsers(tripId) {
  if (!rooms.has(tripId)) {
    return [];
  }

  const room = rooms.get(tripId);
  return Array.from(room).map((conn) => conn.userId);
}

/**
 * Get number of users in a room
 * @param {string} tripId - Trip ID (room identifier)
 * @returns {number} Number of users
 */
export function getRoomSize(tripId) {
  if (!rooms.has(tripId)) {
    return 0;
  }

  return rooms.get(tripId).size;
}

/**
 * Get all active room IDs
 * @returns {string[]} Array of trip IDs with active rooms
 */
export function getActiveRooms() {
  return Array.from(rooms.keys());
}
