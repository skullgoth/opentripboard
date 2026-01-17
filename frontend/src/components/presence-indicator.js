/**
 * T108: PresenceIndicator component - show active users with avatars/initials
 */

/**
 * Create presence indicator component
 * @param {Array} activeUsers - Array of active user objects
 * @param {string} currentUserId - Current user's ID
 * @returns {string} HTML string
 */
export function createPresenceIndicator(activeUsers, currentUserId) {
  if (!activeUsers || activeUsers.length === 0) {
    return `
      <div class="presence-indicator">
        <div class="presence-label">Just you</div>
      </div>
    `;
  }

  // Filter out current user from the list for display
  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId);

  if (otherUsers.length === 0) {
    return `
      <div class="presence-indicator">
        <div class="presence-label">Just you</div>
      </div>
    `;
  }

  // Show max 5 avatars, rest as "+N"
  const maxDisplay = 5;
  const displayUsers = otherUsers.slice(0, maxDisplay);
  const remainingCount = otherUsers.length - maxDisplay;

  const avatars = displayUsers.map(user => `
    <div class="presence-avatar" title="${escapeHtml(user.fullName || user.email)}">
      ${getInitials(user.fullName || user.email)}
    </div>
  `).join('');

  const label = otherUsers.length === 1
    ? `${escapeHtml(displayUsers[0].fullName || displayUsers[0].email)} is also viewing`
    : `${otherUsers.length} others viewing`;

  return `
    <div class="presence-indicator">
      <div class="presence-avatars">
        ${avatars}
        ${remainingCount > 0 ? `
          <div class="presence-avatar presence-more" title="${remainingCount} more">
            +${remainingCount}
          </div>
        ` : ''}
      </div>
      <div class="presence-label">${label}</div>
      <div class="presence-status online">
        <span class="status-dot"></span>
      </div>
    </div>
  `;
}

/**
 * Create compact presence indicator (just avatars, no label)
 * @param {Array} activeUsers - Array of active user objects
 * @param {string} currentUserId - Current user's ID
 * @returns {string} HTML string
 */
export function createCompactPresenceIndicator(activeUsers, currentUserId) {
  if (!activeUsers || activeUsers.length === 0) {
    return '';
  }

  // Filter out current user
  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId);

  if (otherUsers.length === 0) {
    return '';
  }

  // Show max 3 avatars in compact mode
  const maxDisplay = 3;
  const displayUsers = otherUsers.slice(0, maxDisplay);
  const remainingCount = otherUsers.length - maxDisplay;

  const avatars = displayUsers.map(user => `
    <div class="presence-avatar presence-avatar-sm" title="${escapeHtml(user.fullName || user.email)}">
      ${getInitials(user.fullName || user.email)}
    </div>
  `).join('');

  return `
    <div class="presence-indicator presence-compact">
      ${avatars}
      ${remainingCount > 0 ? `
        <div class="presence-avatar presence-avatar-sm presence-more" title="${remainingCount} more">
          +${remainingCount}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create active users list (expanded view)
 * @param {Array} activeUsers - Array of active user objects
 * @param {string} currentUserId - Current user's ID
 * @returns {string} HTML string
 */
export function createActiveUsersList(activeUsers, currentUserId) {
  if (!activeUsers || activeUsers.length === 0) {
    return `
      <div class="active-users-list">
        <h4>Active Users</h4>
        <div class="empty-state-small">
          <p>No other users online</p>
        </div>
      </div>
    `;
  }

  // Sort: current user first, then others alphabetically
  const sortedUsers = [...activeUsers].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    const nameA = a.fullName || a.email || '';
    const nameB = b.fullName || b.email || '';
    return nameA.localeCompare(nameB);
  });

  const userItems = sortedUsers.map(user => {
    const isCurrentUser = user.userId === currentUserId;

    return `
      <div class="active-user-item ${isCurrentUser ? 'current-user' : ''}">
        <div class="presence-avatar">
          ${getInitials(user.fullName || user.email)}
        </div>
        <div class="user-info">
          <div class="user-name">
            ${escapeHtml(user.fullName || user.email)}
            ${isCurrentUser ? '<span class="badge badge-secondary">You</span>' : ''}
          </div>
          ${user.email ? `<div class="user-email">${escapeHtml(user.email)}</div>` : ''}
        </div>
        <div class="presence-status online">
          <span class="status-dot"></span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="active-users-list">
      <h4>Active Users (${activeUsers.length})</h4>
      <div class="user-items">
        ${userItems}
      </div>
    </div>
  `;
}

/**
 * Create typing indicator for collaborative editing
 * @param {Object} user - User who is typing
 * @param {string} location - Location where they're typing (e.g., 'activity-title')
 * @returns {string} HTML string
 */
export function createTypingIndicator(user, location) {
  return `
    <div class="typing-indicator" data-user-id="${user.userId}" data-location="${location}">
      <div class="presence-avatar presence-avatar-xs">
        ${getInitials(user.fullName || user.email)}
      </div>
      <span class="typing-text">
        ${escapeHtml(user.fullName || user.email)} is typing...
      </span>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

/**
 * Get initials from name or email
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

/**
 * Generate random color for avatar based on name
 * @param {string} name - User name or email
 * @returns {string} CSS color value
 */
export function getAvatarColor(name) {
  if (!name) return '#6c757d';

  // Simple hash function to generate consistent colors
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#007bff', // blue
    '#28a745', // green
    '#dc3545', // red
    '#ffc107', // yellow
    '#17a2b8', // cyan
    '#6f42c1', // purple
    '#e83e8c', // pink
    '#fd7e14', // orange
  ];

  return colors[Math.abs(hash) % colors.length];
}
