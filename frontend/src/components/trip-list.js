// T070: TripList component - display user's trips
import { formatDate } from '../utils/date-helpers.js';
import { t } from '../utils/i18n.js';

/**
 * Create trip list component
 * @param {Array} trips - Array of trip objects
 * @param {Function} onTripClick - Callback when trip is clicked
 * @param {Function} onCreateClick - Callback when create button is clicked
 * @returns {string} HTML string
 */
export function createTripList(trips, onTripClick, onCreateClick) {
  if (!trips || trips.length === 0) {
    return `
      <div class="trip-list empty-state">
        <div class="empty-state-content">
          <h2>${t('home.noTrips')}</h2>
          <p>${t('home.noTripsDescription')}</p>
          <button class="btn btn-sm btn-primary btn-lg" data-action="create-trip">
            ${t('home.createFirstTrip')}
          </button>
        </div>
      </div>
    `;
  }

  const tripCards = trips
    .map(
      (trip) => `
    <div class="card trip-card" data-trip-id="${trip.id}">
      ${getCoverImageHtml(trip)}
      <div class="card-body" data-action="view-trip">
        <h3 class="card-title">${escapeHtml(trip.name)}</h3>
        ${trip.destination ? `<p class="trip-destination">${escapeHtml(trip.destination)}</p>` : ''}
        ${trip.description ? `<p class="trip-description">${escapeHtml(trip.description)}</p>` : ''}

        ${
          trip.startDate && trip.endDate
            ? `
          <div class="trip-dates">
            <span class="date-range">
              ${formatDate(trip.startDate, 'medium')} - ${formatDate(trip.endDate, 'medium')}
            </span>
          </div>
        `
            : ''
        }

        ${
          trip.budget
            ? `
          <div class="trip-budget">
            <span class="badge badge-primary">
              Budget: ${trip.currency || 'USD'} ${trip.budget.toLocaleString()}
            </span>
          </div>
        `
            : ''
        }
      </div>
      <div class="card-footer">
        <span class="trip-role badge ${trip.userRole === 'owner' ? 'badge-success' : 'badge-secondary'}">
          ${trip.userRole === 'owner' ? t('trip.owner') : t('trip.collaborator')}
        </span>
        <button class="btn btn-icon btn-danger" data-action="delete-trip" data-trip-id="${trip.id}" title="${t('trip.deleteTrip')}" aria-label="${t('trip.deleteTrip')}">
          <span>🗑️</span>
        </button>
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div class="trip-list">
      <div class="trip-list-header">
        <h2>${t('home.title')}</h2>
        <button class="btn btn-sm btn-primary" data-action="create-trip">
          ${t('home.newTrip')}
        </button>
      </div>
      <div class="trip-grid">
        ${tripCards}
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to trip list
 * @param {HTMLElement} container - Container element
 * @param {Function} onTripClick - Callback when trip is clicked
 * @param {Function} onCreateClick - Callback when create button is clicked
 * @param {Function} onDeleteClick - Callback when delete button is clicked
 */
export function attachTripListListeners(container, onTripClick, onCreateClick, onDeleteClick) {
  // Handle trip card body clicks (view trip)
  container.querySelectorAll('[data-action="view-trip"]').forEach((cardBody) => {
    cardBody.addEventListener('click', () => {
      const tripCard = cardBody.closest('.trip-card');
      const tripId = tripCard.getAttribute('data-trip-id');
      if (onTripClick) onTripClick(tripId);
    });
  });

  // Handle create button clicks
  container.querySelectorAll('[data-action="create-trip"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (onCreateClick) onCreateClick();
    });
  });

  // Handle delete button clicks
  container.querySelectorAll('[data-action="delete-trip"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering the view-trip action
      const tripId = btn.getAttribute('data-trip-id');
      if (onDeleteClick) onDeleteClick(tripId);
    });
  });
}

/**
 * Get cover image HTML for a trip
 * @param {Object} trip - Trip object
 * @returns {string} HTML string for cover image
 */
function getCoverImageHtml(trip) {
  // T042: Use placeholder image for trips without cover
  const coverImageUrl = trip.coverImageUrl || '/images/placeholder-trip.svg';

  return `
    <div class="trip-cover-image-wrapper" data-action="view-trip">
      <img
        src="${coverImageUrl}"
        alt="Cover image for ${escapeHtml(trip.name)}"
        class="trip-cover-image"
        data-testid="trip-cover-image"
        loading="lazy"
      />
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
