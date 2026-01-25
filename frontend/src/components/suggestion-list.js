/**
 * T106: SuggestionList component - pending suggestions, vote counts
 */
import { createSuggestionCard } from './suggestion-card.js';
import { t } from '../utils/i18n.js';
import { createAutocomplete } from './autocomplete.js';
import { searchDestinations } from '../services/geocoding-api.js';
import { getPreferences } from '../state/preferences-state.js';

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
          <div id="suggestion-location-autocomplete-container"></div>
          <input type="hidden" id="suggestion-latitude" name="latitude" />
          <input type="hidden" id="suggestion-longitude" name="longitude" />
          <div class="form-hint" id="suggestion-location-hint" style="display: none;">
            <span class="hint-icon">ℹ️</span>
            <span id="suggestion-location-hint-text"></span>
          </div>
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
 * and initializes the location autocomplete
 * @param {HTMLElement} container - Modal container element
 * @returns {Object} Object with cleanup function and getLocationData method
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

  // Initialize location autocomplete
  const autocompleteContainer = container.querySelector('#suggestion-location-autocomplete-container');
  const latitudeInput = container.querySelector('#suggestion-latitude');
  const longitudeInput = container.querySelector('#suggestion-longitude');
  const locationHint = container.querySelector('#suggestion-location-hint');
  const locationHintText = container.querySelector('#suggestion-location-hint-text');

  let selectedLocationData = null;
  let autocomplete = null;

  function showLocationHint(text, type = 'info') {
    if (locationHintText && locationHint) {
      locationHintText.textContent = text;
      locationHint.className = `form-hint hint-${type}`;
      locationHint.style.display = 'block';
    }
  }

  function hideLocationHint() {
    if (locationHint) {
      locationHint.style.display = 'none';
    }
  }

  if (autocompleteContainer) {
    try {
      autocomplete = createAutocomplete({
        container: autocompleteContainer,
        placeholder: t('suggestion.locationPlaceholder'),
        minChars: 2,
        debounceMs: 300,
        noResultsText: t('suggestion.noLocationsFound', t('tripForm.noDestinationsFound', 'No locations found')),
        loadingText: t('suggestion.searchingLocations', t('tripForm.searchingDestinations', 'Searching...')),
        errorText: t('suggestion.locationSearchError', t('tripForm.destinationSearchError', 'Search unavailable')),
        onSearch: async (query) => {
          try {
            const { language } = getPreferences();
            const result = await searchDestinations(query, { limit: 5, language });
            hideLocationHint();
            return result.results;
          } catch (error) {
            if (error.message === 'SERVICE_UNAVAILABLE') {
              showLocationHint(t('suggestion.autocompleteUnavailable', t('tripForm.autocompleteUnavailable', 'Location search is temporarily unavailable. You can type your location manually.')), 'warning');
            }
            throw error;
          }
        },
        onSelect: (location) => {
          selectedLocationData = location;
          // Set hidden latitude/longitude inputs
          if (latitudeInput && location.lat !== undefined) {
            latitudeInput.value = location.lat;
          }
          if (longitudeInput && location.lon !== undefined) {
            longitudeInput.value = location.lon;
          }
          showLocationHint(`✓ ${t('suggestion.validatedLocation', t('tripForm.validatedDestination', 'Validated location'))}: ${location.display_name}`, 'success');
        },
        formatResult: (location) => location.display_name,
        getItemValue: (location) => location.display_name,
      });

      // Get the autocomplete input for form handling
      const locationInput = autocomplete.getInput();
      locationInput.id = 'suggestion-location';
      locationInput.name = 'location';
      locationInput.maxLength = 255;

      // Track manual input changes (when user types without selecting from dropdown)
      locationInput.addEventListener('input', () => {
        if (selectedLocationData && locationInput.value !== selectedLocationData.display_name) {
          // User modified the selected value - clear coordinates
          selectedLocationData = null;
          if (latitudeInput) latitudeInput.value = '';
          if (longitudeInput) longitudeInput.value = '';
          hideLocationHint();
        }
      });

    } catch (error) {
      console.error('Failed to initialize location autocomplete:', error);
      // Fallback to plain text input
      const fallbackInput = document.createElement('input');
      fallbackInput.type = 'text';
      fallbackInput.id = 'suggestion-location';
      fallbackInput.name = 'location';
      fallbackInput.className = 'form-input';
      fallbackInput.placeholder = t('suggestion.locationPlaceholder');
      fallbackInput.maxLength = 255;
      autocompleteContainer.appendChild(fallbackInput);
      showLocationHint(t('suggestion.autocompleteUnavailable', t('tripForm.autocompleteUnavailable', 'Location search is temporarily unavailable. You can type your location manually.')), 'warning');
    }
  }

  return {
    getLocationData: () => selectedLocationData,
    destroy: () => {
      if (autocomplete) {
        autocomplete.destroy();
      }
    },
  };
}
