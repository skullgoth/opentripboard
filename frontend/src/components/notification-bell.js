// Notification bell component for navbar
import { escapeHtml } from '../utils/html.js';
import { t } from '../utils/i18n.js';
import {
  subscribeToNotifications,
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotifications,
  getUnreadCount,
} from '../state/notification-state.js';
import router from '../utils/router.js';

/**
 * Format a timestamp as relative time
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time (e.g., "5m ago")
 */
function formatTimeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('notifications.justNow');
  if (diffMin < 60) return t('notifications.minutesAgo', { count: diffMin });
  if (diffHr < 24) return t('notifications.hoursAgo', { count: diffHr });
  return t('notifications.daysAgo', { count: diffDay });
}

/**
 * Get icon SVG for notification type
 * @param {string} type - Notification type
 * @returns {string} SVG icon HTML
 */
function getNotificationIcon(type) {
  switch (type) {
    case 'buddy_joined':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
    case 'expense_created':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    case 'suggestion_voted':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
    case 'list_item_completed':
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
    default:
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  }
}

/**
 * Create the notification bell HTML
 * @param {number} unreadCount - Current unread count
 * @returns {string} HTML string
 */
export function createNotificationBell(unreadCount) {
  const badgeClass = unreadCount > 0 ? '' : ' hidden';
  const badgeText = unreadCount > 99 ? '99+' : unreadCount;

  return `
    <div class="notification-bell-container">
      <button id="notification-bell-btn" class="notification-bell-btn" aria-label="${t('notifications.bell')}" aria-haspopup="true" aria-expanded="false">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span id="notification-bell-badge" class="notification-bell-badge${badgeClass}">${badgeText}</span>
      </button>
      <div id="notification-dropdown" class="notification-dropdown hidden">
        <div class="notification-dropdown-header">
          <span class="notification-dropdown-title">${t('notifications.title')}</span>
          <button id="notification-mark-all-read" class="btn btn-sm btn-secondary">${t('notifications.markAllRead')}</button>
        </div>
        <div id="notification-list" class="notification-list">
          ${renderNotificationList(getNotifications())}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the notification list HTML
 * @param {Array} notifications - Notifications array
 * @returns {string} HTML string
 */
function renderNotificationList(notifications) {
  if (!notifications || notifications.length === 0) {
    return `<div class="notification-empty">${t('notifications.empty')}</div>`;
  }

  return notifications
    .map(
      (n) => `
      <div class="notification-item${n.isRead ? ' notification-item--read' : ''}" data-notification-id="${n.id}" data-trip-id="${n.tripId || ''}">
        <div class="notification-item__icon">${getNotificationIcon(n.type)}</div>
        <div class="notification-item__content">
          <div class="notification-item__title">${escapeHtml(n.title)}</div>
          ${n.tripName ? `<div class="notification-item__trip">${escapeHtml(n.tripName)}</div>` : ''}
          <div class="notification-item__time">${formatTimeAgo(n.createdAt)}</div>
        </div>
        <button class="notification-item__dismiss" data-dismiss-id="${n.id}" aria-label="${t('common.delete')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `
    )
    .join('');
}

/**
 * Attach event listeners for the notification bell
 */
export function attachNotificationBellListeners() {
  const bellBtn = document.getElementById('notification-bell-btn');
  const dropdown = document.getElementById('notification-dropdown');
  const markAllBtn = document.getElementById('notification-mark-all-read');

  if (!bellBtn || !dropdown) return;

  // Toggle dropdown
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
      dropdown.classList.remove('hidden');
      bellBtn.setAttribute('aria-expanded', 'true');
      // Refresh notifications when opening
      fetchNotifications();
    } else {
      dropdown.classList.add('hidden');
      bellBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Mark all as read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllAsRead();
    });
  }

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!bellBtn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
      bellBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Delegate clicks on notification items and dismiss buttons
  const listEl = document.getElementById('notification-list');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      // Handle dismiss button
      const dismissBtn = e.target.closest('[data-dismiss-id]');
      if (dismissBtn) {
        e.stopPropagation();
        deleteNotification(dismissBtn.dataset.dismissId);
        return;
      }

      // Handle click on notification item (navigate to trip)
      const item = e.target.closest('.notification-item');
      if (item) {
        const notificationId = item.dataset.notificationId;
        const tripId = item.dataset.tripId;

        // Mark as read
        markAsRead(notificationId);

        // Close dropdown
        dropdown.classList.add('hidden');
        bellBtn.setAttribute('aria-expanded', 'false');

        // Navigate to trip if available
        if (tripId) {
          router.navigate(`/trips/${tripId}`);
        }
      }
    });
  }

  // Subscribe to state changes to update the UI
  subscribeToNotifications(({ notifications, unreadCount }) => {
    updateBadgeCount(unreadCount);
    const listContainer = document.getElementById('notification-list');
    if (listContainer) {
      listContainer.innerHTML = renderNotificationList(notifications);
    }
  });
}

/**
 * Update the badge count
 * @param {number} count - Unread count
 */
export function updateBadgeCount(count) {
  const badge = document.getElementById('notification-bell-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
