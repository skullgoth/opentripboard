// Notification queries module
import { query } from '../connection.js';

/**
 * Create a new notification
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Created notification with actor/trip info
 */
export async function create(data) {
  const { userId, tripId, type, title, message, entityId, entityType, actorId } = data;

  const result = await query(
    `INSERT INTO notifications (user_id, trip_id, type, title, message, entity_id, entity_type, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, tripId, type, title, message || null, entityId || null, entityType || null, actorId || null]
  );

  return findById(result.rows[0].id);
}

/**
 * Find notification by ID
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object|null>} Notification or null
 */
export async function findById(notificationId) {
  const result = await query(
    `SELECT n.*,
            u.full_name as actor_name,
            t.name as trip_name
     FROM notifications n
     LEFT JOIN users u ON n.actor_id = u.id
     LEFT JOIN trips t ON n.trip_id = t.id
     WHERE n.id = $1`,
    [notificationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatNotification(result.rows[0]);
}

/**
 * Find notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max results (default 20)
 * @param {number} options.offset - Offset (default 0)
 * @returns {Promise<Array>} Array of notifications
 */
export async function findByUserId(userId, { limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT n.*,
            u.full_name as actor_name,
            t.name as trip_name
     FROM notifications n
     LEFT JOIN users u ON n.actor_id = u.id
     LEFT JOIN trips t ON n.trip_id = t.id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows.map(formatNotification);
}

/**
 * Count unread notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
export async function countUnread(userId) {
  const result = await query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<Object|null>} Updated notification or null
 */
export async function markAsRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return findById(notificationId);
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications updated
 */
export async function markAllAsRead(userId) {
  const result = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return result.rowCount;
}

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteNotification(notificationId, userId) {
  const result = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [notificationId, userId]
  );

  return result.rows.length > 0;
}

/**
 * Format notification from database row
 * @param {Object} row - Database row
 * @returns {Object} Formatted notification
 */
function formatNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityId: row.entity_id,
    entityType: row.entity_type,
    actorId: row.actor_id,
    actorName: row.actor_name || null,
    tripName: row.trip_name || null,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}
