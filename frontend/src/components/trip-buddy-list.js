// Trip Buddy List Component - Display and manage trip tripBuddies
import { createPresenceIndicator } from './presence-indicator.js';
import { t } from '../utils/i18n.js';

/**
 * Create tripBuddy list component
 * @param {Array} tripBuddies - Array of tripBuddy objects
 * @param {string} tripOwnerId - Trip owner's user ID
 * @param {string} currentUserId - Current user's ID
 * @param {boolean} isOwner - Whether current user is the trip owner
 * @param {Array} activeUsers - Array of user IDs currently active
 * @returns {string} HTML string
 */
export function createTripBuddyList(tripBuddies, tripOwnerId, currentUserId, isOwner, activeUsers = []) {
  console.log('[TripBuddyList] Rendering with activeUsers:', activeUsers);

  if (!tripBuddies || tripBuddies.length === 0) {
    return `
      <div class="trip-buddy-list">
        <div class="trip-buddy-header">
          <h3>${t('tripBuddy.title')}</h3>
          ${isOwner ? `
            <button
              class="btn btn-sm btn-primary"
              data-action="invite-trip-buddy"
              aria-label="${t('tripBuddy.inviteBuddy')}">
              <span class="icon">+</span> ${t('tripBuddy.invite')}
            </button>
          ` : ''}
        </div>
        <div class="empty-state-small">
          <p>${t('tripBuddy.noBuddies')}</p>
          ${isOwner ? `<p class="text-muted">${t('tripBuddy.inviteHint')}</p>` : ''}
        </div>
      </div>
    `;
  }

  const tripBuddyItems = tripBuddies.map(tripBuddy => {
    const userId = tripBuddy.userId || tripBuddy.user_id; // Support both formats
    const isCurrentUser = userId === currentUserId;
    const isTripBuddyOwner = userId === tripOwnerId;
    const isActive = activeUsers.includes(userId);

    // Build tooltip text
    const displayName = tripBuddy.full_name || '';
    const role = isTripBuddyOwner ? t('tripBuddy.owner') : capitalizeRole(tripBuddy.role);
    const tooltipParts = [];

    if (displayName) {
      tooltipParts.push(escapeHtml(displayName));
    }
    tooltipParts.push(escapeHtml(tripBuddy.email));
    tooltipParts.push(`${t('tripBuddy.roleLabel')}: ${role}${isCurrentUser ? ` ${t('tripBuddy.you')}` : ''}`);
    if (isActive) {
      tooltipParts.push(`🟢 ${t('tripBuddy.online')}`);
    }

    const tooltipText = tooltipParts.join('\n');

    console.log('[TripBuddy] Rendering buddy:', tripBuddy.email, 'isActive:', isActive, 'userId:', userId);

    return `
      <div class="trip-buddy-item-compact ${isCurrentUser ? 'current-user' : ''}" data-trip-buddy-id="${tripBuddy.id}" data-user-id="${userId}">
        <div
          class="trip-buddy-avatar-badge ${isActive ? 'is-active' : ''}"
          title="${tooltipText}"
          style="background-color: ${getAvatarColor(tripBuddy.email)}">
          ${getInitialsFromFullName(tripBuddy.full_name, tripBuddy.email)}
          ${isActive ? '<span class="presence-indicator"></span>' : ''}
        </div>
        ${isOwner && !isTripBuddyOwner ? `
          <button
            class="btn-remove-buddy"
            data-action="remove-trip-buddy"
            data-trip-buddy-id="${tripBuddy.id}"
            title="${t('tripBuddy.removeBuddy')}"
            aria-label="${t('tripBuddy.removeBuddy')}">
            ✕
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="trip-buddy-list">
      <div class="trip-buddy-header">
        <h3>${t('tripBuddy.title')} (${tripBuddies.length})</h3>
        ${isOwner ? `
          <button
            class="btn btn-sm btn-primary"
            data-action="invite-trip-buddy"
            aria-label="${t('tripBuddy.inviteBuddy')}">
            <span class="icon">+</span> ${t('tripBuddy.invite')}
          </button>
        ` : ''}
      </div>
      <div class="trip-buddy-items">
        ${tripBuddyItems}
      </div>
    </div>
  `;
}

/**
 * Create compact tripBuddy list (for sidebar or header)
 * @param {Array} tripBuddies - Array of tripBuddy objects
 * @param {string} currentUserId - Current user's ID
 * @param {boolean} showInvite - Whether to show invite button
 * @param {Array} activeUsers - Array of active user IDs for presence
 * @returns {string} HTML string
 */
export function createCompactTripBuddyList(tripBuddies, currentUserId, showInvite = false, activeUsers = []) {
  const maxDisplay = 4;
  const displayTripBuddies = (tripBuddies || []).slice(0, maxDisplay);
  const remainingCount = (tripBuddies || []).length - maxDisplay;

  const avatars = displayTripBuddies.map(collab => {
    const userId = collab.user_id || collab.userId;
    const isActive = activeUsers.includes(String(userId));
    return `
    <div
      class="trip-buddy-avatar trip-buddy-avatar-sm ${isActive ? 'is-active' : ''}"
      data-user-id="${userId}"
      title="${escapeHtml(collab.full_name || collab.email)}"
      style="background-color: ${getAvatarColor(collab.email)}">
      ${getInitials(collab.full_name || collab.email)}
      ${isActive ? '<span class="presence-indicator"></span>' : ''}
    </div>
  `;
  }).join('');

  return `
    <div class="trip-buddy-list-compact">
      ${avatars}
      ${remainingCount > 0 ? `
        <div class="trip-buddy-avatar trip-buddy-avatar-sm trip-buddy-more" title="${remainingCount} more">
          +${remainingCount}
        </div>
      ` : ''}
      ${showInvite ? `
        <button
          class="trip-buddy-avatar trip-buddy-avatar-sm trip-buddy-invite"
          data-action="invite-trip-buddy"
          title="${t('tripBuddy.inviteBuddy')}"
          aria-label="${t('tripBuddy.inviteBuddy')}">
          <span class="icon">👤+</span>
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Get initials from full name (first and last name)
 * @param {string} fullName - Full name (e.g., "User Test")
 * @param {string} email - Email as fallback
 * @returns {string} Initials (e.g., "UT" for "User Test")
 */
function getInitialsFromFullName(fullName, email) {
  if (!fullName) {
    // Fallback to email first letter if no full name
    return email ? email.charAt(0).toUpperCase() : '?';
  }

  // Split full name into words
  const words = fullName.trim().split(/\s+/);

  if (words.length === 1) {
    // Only one word, use first letter
    return words[0].charAt(0).toUpperCase();
  }

  // Use first letter of first word and first letter of last word
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get initials from name or email (for compact list)
 * @param {string} nameOrEmail - Name or email
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';

  // If it's an email, use first letter before @
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.charAt(0).toUpperCase();
  }

  // Otherwise, get first letter of each word
  const words = nameOrEmail.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate avatar color based on name/email
 * @param {string} str - Name or email
 * @returns {string} CSS color value
 */
function getAvatarColor(str) {
  if (!str) return '#6c757d';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107',
    '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14',
  ];

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Capitalize role name
 * @param {string} role - Role name
 * @returns {string} Capitalized role
 */
function capitalizeRole(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
