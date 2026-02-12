/**
 * ActivityCard Component
 * T074: Display activity with edit/delete actions
 */

import { formatTime } from '../utils/date-helpers.js';
import { t } from '../utils/i18n.js';

/**
 * Create activity card element
 * @param {Object} activity - Activity object
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} Activity card element
 */
export function createActivityCard(activity, options = {}) {
  const { draggable = true, onEdit, onDelete } = options;

  const card = document.createElement('div');
  card.className = 'activity-card';
  card.setAttribute('data-activity-id', activity.id);
  card.setAttribute('data-order-index', activity.orderIndex || 0);

  if (draggable) {
    card.setAttribute('draggable', 'true');
  }

  card.innerHTML = createActivityCardContent(activity);

  // Attach event listeners
  if (onEdit) {
    const editBtn = card.querySelector('[data-action="edit-activity"]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onEdit(activity.id);
      });
    }
  }

  if (onDelete) {
    const deleteBtn = card.querySelector('[data-action="delete-activity"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(t('itinerary.confirmDeleteActivity'))) {
          await onDelete(activity.id);
        }
      });
    }
  }

  return card;
}

/**
 * Create activity card content (HTML)
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
export function createActivityCardContent(activity) {
  const typeIcons = {
    flight: '✈️',
    accommodation: '🏨',
    restaurant: '🍽️',
    attraction: '🎭',
    transportation: '🚗',
    meeting: '👥',
    event: '🎉',
    other: '📌',
  };

  const icon = typeIcons[activity.type] || typeIcons.other;

  return `
    <div class="activity-card-content">
      <div class="activity-card-header">
        <span class="activity-icon">${icon}</span>
        <div class="activity-info">
          <h4 class="activity-title">${escapeHtml(activity.title)}</h4>
          ${activity.location ? `<p class="activity-location">📍 ${escapeHtml(activity.location)}</p>` : ''}
        </div>
        <div class="activity-actions">
          <button class="btn-icon" data-action="edit-activity" data-activity-id="${activity.id}" title="${t('common.edit')}" aria-label="${t('activityCard.editActivity')}">
            ✏️
          </button>
          <button class="btn-icon" data-action="delete-activity" data-activity-id="${activity.id}" title="${t('common.delete')}" aria-label="${t('activityCard.deleteActivity')}">
            🗑️
          </button>
        </div>
      </div>
      ${
        activity.startTime || activity.endTime
          ? `
        <div class="activity-time">
          ${activity.startTime ? `<span class="time-start">${formatTime(activity.startTime)}</span>` : ''}
          ${activity.startTime && activity.endTime ? '<span class="time-separator"> - </span>' : ''}
          ${activity.endTime ? `<span class="time-end">${formatTime(activity.endTime)}</span>` : ''}
        </div>
      `
          : ''
      }
      ${activity.description ? `<p class="activity-description">${escapeHtml(activity.description)}</p>` : ''}
      ${formatCoordinates(activity)}
      <div class="activity-footer">
        <span class="activity-type-badge badge badge-${activity.type}">${activity.type}</span>
        ${activity.metadata && activity.metadata.cost ? `<span class="activity-cost">💰 ${activity.metadata.cost}</span>` : ''}
        ${formatActivityAttribution(activity)}
      </div>
    </div>
  `;
}

/**
 * Render activity card to container
 * @param {HTMLElement} container - Container element
 * @param {Object} activity - Activity object
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} Created activity card
 */
export function renderActivityCard(container, activity, options = {}) {
  const card = createActivityCard(activity, options);
  container.appendChild(card);
  return card;
}

/**
 * Update activity card content
 * @param {HTMLElement} card - Activity card element
 * @param {Object} activity - Updated activity object
 */
export function updateActivityCard(card, activity) {
  card.setAttribute('data-activity-id', activity.id);
  card.setAttribute('data-order-index', activity.orderIndex || 0);
  card.innerHTML = createActivityCardContent(activity);
}

/**
 * Remove activity card
 * @param {HTMLElement} card - Activity card element
 * @param {boolean} animate - Whether to animate removal
 */
export function removeActivityCard(card, animate = true) {
  if (animate) {
    card.classList.add('removing');
    setTimeout(() => {
      card.remove();
    }, 300);
  } else {
    card.remove();
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get activity type icon
 * @param {string} type - Activity type
 * @returns {string} Icon emoji
 */
export function getActivityTypeIcon(type) {
  const typeIcons = {
    flight: '✈️',
    accommodation: '🏨',
    restaurant: '🍽️',
    attraction: '🎭',
    transportation: '🚗',
    meeting: '👥',
    event: '🎉',
    other: '📌',
  };

  return typeIcons[type] || typeIcons.other;
}

/**
 * Format activity attribution (T151: Display who created/updated)
 * @param {Object} activity - Activity object
 * @returns {string} Attribution HTML
 */
function formatActivityAttribution(activity) {
  if (!activity.createdByName && !activity.updatedByName) {
    return '';
  }

  const parts = [];

  if (activity.createdByName) {
    parts.push(t('activityCard.addedBy', { name: escapeHtml(activity.createdByName) }));
  }

  if (activity.updatedByName && activity.updatedByName !== activity.createdByName) {
    parts.push(t('activityCard.updatedBy', { name: escapeHtml(activity.updatedByName) }));
  }

  if (parts.length === 0) {
    return '';
  }

  return `<span class="activity-attribution text-muted">${parts.join(' • ')}</span>`;
}

/**
 * Format coordinates display (US3: Show coordinates in activity cards)
 * @param {Object} activity - Activity object
 * @returns {string} Coordinates HTML
 */
function formatCoordinates(activity) {
  if (!activity.latitude || !activity.longitude) {
    return '';
  }

  const lat = parseFloat(activity.latitude).toFixed(4);
  const lng = parseFloat(activity.longitude).toFixed(4);
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${activity.latitude},${activity.longitude}`;

  return `<div class="activity-coordinates">📍 ${lat}, ${lng} <a class="btn-street-view" href="${streetViewUrl}" target="_blank" rel="noopener noreferrer" title="${t('activity.streetView')}">${t('activity.streetView')}</a></div>`;
}
