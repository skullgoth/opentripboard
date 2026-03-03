// Notification state management
import { get, post, patch, del } from '../services/api-client.js';
import { logError } from '../utils/error-tracking.js';

const state = {
  notifications: [],
  unreadCount: 0,
  subscribers: new Set(),
};

function notifySubscribers() {
  state.subscribers.forEach((callback) => {
    try {
      callback({ notifications: state.notifications, unreadCount: state.unreadCount });
    } catch (error) {
      logError('[NotificationState] Subscriber error:', error);
    }
  });
}

/**
 * Subscribe to notification state changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(callback) {
  state.subscribers.add(callback);
  return () => state.subscribers.delete(callback);
}

/**
 * Fetch notifications from API
 * @param {number} limit - Max results
 */
export async function fetchNotifications(limit = 20) {
  try {
    const notifications = await get('/notifications', { limit });
    state.notifications = notifications;
    notifySubscribers();
  } catch (error) {
    logError('[NotificationState] Failed to fetch notifications:', error);
  }
}

/**
 * Fetch unread count from API
 */
export async function fetchUnreadCount() {
  try {
    const result = await get('/notifications/unread-count');
    state.unreadCount = result.count;
    notifySubscribers();
  } catch (error) {
    logError('[NotificationState] Failed to fetch unread count:', error);
  }
}

/**
 * Add a notification received via WebSocket
 * @param {Object} notification - Notification object
 */
export function addNotification(notification) {
  state.notifications.unshift(notification);
  state.unreadCount++;
  notifySubscribers();
}

/**
 * Mark a notification as read
 * @param {string} id - Notification ID
 */
export async function markAsRead(id) {
  try {
    const updated = await patch(`/notifications/${id}/read`);
    const index = state.notifications.findIndex((n) => n.id === id);
    if (index !== -1) {
      state.notifications[index] = updated;
    }
    state.unreadCount = Math.max(0, state.unreadCount - 1);
    notifySubscribers();
  } catch (error) {
    logError('[NotificationState] Failed to mark as read:', error);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead() {
  try {
    await post('/notifications/mark-all-read');
    state.notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
    state.unreadCount = 0;
    notifySubscribers();
  } catch (error) {
    logError('[NotificationState] Failed to mark all as read:', error);
  }
}

/**
 * Delete a notification
 * @param {string} id - Notification ID
 */
export async function deleteNotification(id) {
  try {
    await del(`/notifications/${id}`);
    const notification = state.notifications.find((n) => n.id === id);
    state.notifications = state.notifications.filter((n) => n.id !== id);
    if (notification && !notification.isRead) {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    }
    notifySubscribers();
  } catch (error) {
    logError('[NotificationState] Failed to delete notification:', error);
  }
}

/**
 * Clear all notification state (on logout)
 */
export function clearNotificationState() {
  state.notifications = [];
  state.unreadCount = 0;
  notifySubscribers();
}

/**
 * Get current unread count
 * @returns {number}
 */
export function getUnreadCount() {
  return state.unreadCount;
}

/**
 * Get current notifications
 * @returns {Array}
 */
export function getNotifications() {
  return state.notifications;
}
