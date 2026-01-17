/**
 * T107: SuggestionCard component - suggestion details, vote buttons, accept/reject for owner
 */

/**
 * Create suggestion card component
 * @param {Object} suggestion - Suggestion object
 * @param {string} currentUserId - Current user's ID
 * @param {string} userRole - Current user's role ('owner' | 'editor' | 'viewer')
 * @returns {string} HTML string
 */
export function createSuggestionCard(suggestion, currentUserId, userRole) {
  const canResolve = userRole === 'owner' || userRole === 'editor';
  const isOwn = suggestion.suggestedByUserId === currentUserId;
  const isPending = suggestion.status === 'pending';

  // Calculate user's vote
  const userVote = suggestion.votes?.find(v => v.userId === currentUserId);
  const hasUpvoted = userVote?.vote === 'up';
  const hasDownvoted = userVote?.vote === 'down';

  return `
    <div class="suggestion-card ${suggestion.status}" data-suggestion-id="${suggestion.id}">
      <div class="suggestion-header">
        <div class="suggestion-type">
          <span class="activity-icon activity-icon-${suggestion.activityType}">
            ${getActivityIcon(suggestion.activityType)}
          </span>
          <span class="activity-type-label">${formatActivityType(suggestion.activityType)}</span>
        </div>
        <span class="suggestion-status badge badge-${getStatusBadgeClass(suggestion.status)}">
          ${suggestion.status}
        </span>
      </div>

      <div class="suggestion-body">
        <h4 class="suggestion-title">${escapeHtml(suggestion.title)}</h4>

        ${suggestion.description ? `
          <p class="suggestion-description">${escapeHtml(suggestion.description)}</p>
        ` : ''}

        ${suggestion.location ? `
          <div class="suggestion-location">
            <span class="icon">📍</span>
            ${escapeHtml(suggestion.location)}
          </div>
        ` : ''}

        ${suggestion.startTime ? `
          <div class="suggestion-time">
            <span class="icon">🕐</span>
            ${formatDateTime(suggestion.startTime)}
            ${suggestion.endTime ? ` - ${formatDateTime(suggestion.endTime)}` : ''}
          </div>
        ` : ''}

        <div class="suggestion-meta">
          <span class="suggestion-author">
            Suggested by ${isOwn ? 'You' : escapeHtml(suggestion.suggestedByName || 'Unknown')}
          </span>
          <span class="suggestion-date">
            ${formatRelativeTime(suggestion.createdAt)}
          </span>
        </div>
      </div>

      ${isPending ? `
        <div class="suggestion-voting">
          <div class="vote-buttons">
            <button
              class="btn btn-sm btn-vote ${hasUpvoted ? 'active' : ''}"
              data-action="vote-suggestion"
              data-suggestion-id="${suggestion.id}"
              data-vote="up"
              title="Upvote">
              <span class="icon">👍</span>
              <span class="vote-count">${suggestion.upvotes || 0}</span>
            </button>
            <button
              class="btn btn-sm btn-vote ${hasDownvoted ? 'active' : ''}"
              data-action="vote-suggestion"
              data-suggestion-id="${suggestion.id}"
              data-vote="down"
              title="Downvote">
              <span class="icon">👎</span>
              <span class="vote-count">${suggestion.downvotes || 0}</span>
            </button>
          </div>

          ${canResolve ? `
            <div class="suggestion-actions">
              <button
                class="btn btn-sm btn-success"
                data-action="accept-suggestion"
                data-suggestion-id="${suggestion.id}"
                title="Accept and add to itinerary">
                Accept
              </button>
              <button
                class="btn btn-sm btn-danger"
                data-action="reject-suggestion"
                data-suggestion-id="${suggestion.id}"
                title="Reject suggestion">
                Reject
              </button>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${suggestion.status === 'accepted' && suggestion.resolvedAt ? `
        <div class="suggestion-resolved">
          <span class="icon">✅</span>
          Accepted and added to itinerary
          ${suggestion.resolvedBy ? `by ${escapeHtml(suggestion.resolvedByName || 'someone')}` : ''}
        </div>
      ` : ''}

      ${suggestion.status === 'rejected' && suggestion.resolvedAt ? `
        <div class="suggestion-resolved">
          <span class="icon">❌</span>
          Rejected
          ${suggestion.resolvedBy ? `by ${escapeHtml(suggestion.resolvedByName || 'someone')}` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Get activity icon
 * @param {string} type - Activity type
 * @returns {string} Icon emoji
 */
function getActivityIcon(type) {
  const icons = {
    flight: '✈️',
    accommodation: '🏨',
    restaurant: '🍽️',
    attraction: '🎭',
    transportation: '🚗',
    meeting: '🤝',
    event: '🎉',
    other: '📌',
  };
  return icons[type] || '📌';
}

/**
 * Format activity type
 * @param {string} type - Activity type
 * @returns {string} Formatted type
 */
function formatActivityType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Get status badge class
 * @param {string} status - Status ('pending' | 'accepted' | 'rejected')
 * @returns {string} Badge class
 */
function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'accepted':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'secondary';
  }
}

/**
 * Format date and time
 * @param {string} dateTimeStr - ISO datetime string
 * @returns {string} Formatted datetime
 */
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string} dateTimeStr - ISO datetime string
 * @returns {string} Relative time string
 */
function formatRelativeTime(dateTimeStr) {
  if (!dateTimeStr) return '';

  const date = new Date(dateTimeStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
