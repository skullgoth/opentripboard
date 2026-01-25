/**
 * T106: SuggestionList component - pending suggestions, vote counts
 */
import { createSuggestionCard } from './suggestion-card.js';
import { t } from '../utils/i18n.js';

/**
 * Create suggestion list component
 * @param {Array} suggestions - Array of suggestion objects
 * @param {string} currentUserId - Current user's ID
 * @param {string} userRole - Current user's role ('owner' | 'editor' | 'viewer')
 * @param {Function} onCreateClick - Callback when create suggestion button is clicked
 * @returns {string} HTML string
 */
export function createSuggestionList(suggestions, currentUserId, userRole, onCreateClick) {
  const canSuggest = true; // All collaborators can suggest

  // Separate by status
  const pending = suggestions.filter(s => s.status === 'pending');
  const history = suggestions.filter(s => s.status === 'accepted' || s.status === 'rejected');

  const header = `
    <div class="suggestion-list-header">
      <h3>${t('suggestion.title')}</h3>
      ${canSuggest ? `
        <button class="btn btn-sm btn-primary" data-action="create-suggestion">
          <span class="icon">💡</span> ${t('suggestion.suggestActivity')}
        </button>
      ` : ''}
    </div>
  `;

  if (suggestions.length === 0) {
    return `
      <div class="suggestion-list">
        ${header}
        <div class="empty-state-small">
          <p>${t('suggestion.noSuggestions')}</p>
          ${canSuggest ? `<p class="text-muted">${t('suggestion.beFirstToSuggest')}</p>` : ''}
        </div>
      </div>
    `;
  }

  // Pending suggestions
  const pendingSection = `
    <div class="suggestion-section">
      ${pending.length > 0 ? `
        <div class="suggestion-cards">
          ${pending.map(s => createSuggestionCard(s, currentUserId, userRole)).join('')}
        </div>
      ` : `
        <div class="empty-state-small">
          <p>${t('suggestion.noPendingSuggestions')}</p>
        </div>
      `}
    </div>
  `;

  // History button and section (hidden by default)
  const historySection = history.length > 0 ? `
    <div class="suggestion-history-container">
      <button class="btn btn-sm btn-secondary btn-sm" data-action="toggle-history" aria-expanded="false">
        <span class="icon">📜</span> ${t('suggestion.showHistory')} (${history.length})
      </button>
      <div class="suggestion-history" style="display: none;">
        <div class="suggestion-history-content">
          <!-- History items will be rendered here by pagination -->
        </div>
        <div class="suggestion-history-pagination" style="display: none;">
          <!-- Pagination controls -->
        </div>
      </div>
    </div>
  ` : '';

  return `
    <div class="suggestion-list">
      ${header}
      ${pendingSection}
      ${historySection}
    </div>
  `;
}

/**
 * Render paginated history
 * @param {Array} history - Array of accepted/rejected suggestions
 * @param {string} currentUserId - Current user's ID
 * @param {string} userRole - Current user's role
 * @param {number} page - Current page (1-indexed)
 * @param {number} perPage - Items per page
 * @returns {Object} { html, totalPages }
 */
export function renderPaginatedHistory(history, currentUserId, userRole, page = 1, perPage = 5) {
  const totalPages = Math.ceil(history.length / perPage);
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const pageItems = history.slice(startIndex, endIndex);

  const contentHtml = pageItems.length > 0 ? `
    <div class="suggestion-cards">
      ${pageItems.map(s => createSuggestionCard(s, currentUserId, userRole)).join('')}
    </div>
  ` : `
    <div class="empty-state-small">
      <p>${t('suggestion.noHistory')}</p>
    </div>
  `;

  const paginationHtml = totalPages > 1 ? `
    <div class="pagination">
      <button
        class="btn btn-sm btn-secondary"
        data-action="prev-page"
        ${page === 1 ? 'disabled' : ''}
        aria-label="${t('suggestion.previous')}">
        ← ${t('suggestion.previous')}
      </button>
      <span class="pagination-info">
        ${t('suggestion.pageOf', { page, total: totalPages })}
      </span>
      <button
        class="btn btn-sm btn-secondary"
        data-action="next-page"
        ${page === totalPages ? 'disabled' : ''}
        aria-label="${t('suggestion.next')}">
        ${t('suggestion.next')} →
      </button>
    </div>
  ` : '';

  return {
    contentHtml,
    paginationHtml,
    totalPages
  };
}

/**
 * Create suggestion form modal
 * @param {Object} trip - Trip object with id, startDate, endDate
 * @returns {string} HTML string
 */
export function createSuggestionForm(trip) {
  const tripId = trip.id;
  // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
  const minDate = trip.startDate ? `${trip.startDate.split('T')[0]}T00:00` : '';
  const maxDate = trip.endDate ? `${trip.endDate.split('T')[0]}T23:59` : '';

  return `
    <div class="modal-overlay" id="suggestion-form-modal" data-modal="suggestion-form">
      <div class="modal-dialog">
        <div class="modal-header">
          <h2 class="modal-title">${t('suggestion.suggestActivityTitle')}</h2>
          <button class="modal-close" data-action="close-modal" aria-label="${t('common.close')}">&times;</button>
        </div>

        <form id="suggestion-form" class="modal-body" data-trip-id="${tripId}">
        <div class="form-group">
          <label for="suggestion-type" class="form-label">${t('suggestion.activityTypeRequired')}</label>
          <select
            id="suggestion-type"
            name="activityType"
            class="form-select"
            required
          >
            <option value="">${t('suggestion.selectType')}</option>
            <option value="flight">✈️ ${t('activity.types.flight')}</option>
            <option value="accommodation">🏨 ${t('activity.types.accommodation')}</option>
            <option value="restaurant">🍽️ ${t('activity.types.restaurant')}</option>
            <option value="attraction">🎭 ${t('activity.types.attraction')}</option>
            <option value="transportation">🚗 ${t('activity.types.transportation')}</option>
            <option value="meeting">🤝 ${t('activity.types.meeting')}</option>
            <option value="event">🎉 ${t('activity.types.event')}</option>
            <option value="other">📌 ${t('activity.types.other')}</option>
          </select>
          <div class="form-error" data-error="activityType"></div>
        </div>

        <div class="form-group">
          <label for="suggestion-title" class="form-label">${t('suggestion.titleRequired')}</label>
          <input
            type="text"
            id="suggestion-title"
            name="title"
            class="form-input"
            placeholder="${t('suggestion.titlePlaceholder')}"
            required
            maxlength="255"
          />
          <div class="form-error" data-error="title"></div>
        </div>

        <div class="form-group">
          <label for="suggestion-description" class="form-label">${t('activity.description')}</label>
          <textarea
            id="suggestion-description"
            name="description"
            class="form-textarea"
            placeholder="${t('suggestion.descriptionPlaceholder')}"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="suggestion-location" class="form-label">${t('activity.location')}</label>
          <input
            type="text"
            id="suggestion-location"
            name="location"
            class="form-input"
            placeholder="${t('suggestion.locationPlaceholder')}"
            maxlength="255"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="suggestion-start-time" class="form-label">${t('activity.startTime')}</label>
            <input
              type="datetime-local"
              id="suggestion-start-time"
              name="startTime"
              class="form-input"
              ${minDate ? `min="${minDate}"` : ''}
              ${maxDate ? `max="${maxDate}"` : ''}
            />
            <div class="form-error" data-error="startTime"></div>
          </div>

          <div class="form-group">
            <label for="suggestion-end-time" class="form-label">${t('activity.endTime')} <span class="form-label-optional">(${t('common.optional')})</span></label>
            <input
              type="datetime-local"
              id="suggestion-end-time"
              name="endTime"
              class="form-input"
              ${maxDate ? `max="${maxDate}"` : ''}
            />
            <div class="form-error" data-error="endTime"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-sm btn-secondary" data-action="close-modal">
            ${t('common.cancel')}
          </button>
          <button type="submit" class="btn btn-sm btn-primary">
            ${t('suggestion.submitSuggestion')}
          </button>
        </div>
      </form>
      </div>
    </div>
  `;
}

/**
 * Attach suggestion form listeners
 * Sets up the dynamic min constraint for end time based on start time
 * @param {HTMLElement} container - Modal container element
 */
export function attachSuggestionFormListeners(container) {
  const startTimeInput = container.querySelector('#suggestion-start-time');
  const endTimeInput = container.querySelector('#suggestion-end-time');

  if (startTimeInput && endTimeInput) {
    startTimeInput.addEventListener('change', () => {
      if (startTimeInput.value) {
        // Set end time min to start time value
        endTimeInput.min = startTimeInput.value;
        // If end time is before start time, clear it
        if (endTimeInput.value && endTimeInput.value < startTimeInput.value) {
          endTimeInput.value = '';
        }
      }
    });
  }
}
