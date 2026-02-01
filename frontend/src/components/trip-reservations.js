/**
 * Trip Reservations Component - displays Lodging, Transport, and Dining sections
 * Used in trip detail page before the activities timeline
 * Features: collapsible cards, inline editing, Nominatim location search
 * T034/T036: Updated to use category resolver for dynamic reservation types
 */
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';
import { getCategoryIcon, getCategoryName, buildCategoryOptions } from '../utils/category-resolver.js';
import { getCategories as getCategoriesState } from '../state/categories-state.js';
import { formatDate as formatDateLocale, formatTime as formatTimeLocale } from '../utils/date-helpers.js';

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const NOMINATIM_RATE_LIMIT_MS = 1100; // 1 request per second + buffer
let lastNominatimRequest = 0;

// Module-level trip date constraints for reservation editing
let tripDateConstraints = { minDate: '', maxDate: '' };

/**
 * Set trip date constraints for reservation forms
 * @param {Object} trip - Trip object with startDate and endDate
 */
export function setTripDateConstraints(trip) {
  tripDateConstraints = {
    minDate: trip.startDate ? trip.startDate.split('T')[0] : '',
    maxDate: trip.endDate ? trip.endDate.split('T')[0] : '',
  };
}

/**
 * Filter activities to get only reservations of specific types
 * @param {Array} activities - All activities
 * @param {Array} types - Activity types to filter
 * @returns {Array} Filtered reservations
 */
function filterReservationsByType(activities, types) {
  return activities.filter(a =>
    a.metadata?.isReservation && types.includes(a.type)
  );
}

/**
 * Create the Lodging section
 * Types: Hotel, Rental (alphabetically sorted)
 * @param {Array} activities - All activities
 * @returns {string} HTML string
 */
export function createLodgingSection(activities) {
  const lodgingTypes = ['hotel', 'rental'];
  const lodgingReservations = filterReservationsByType(activities, lodgingTypes);

  if (lodgingReservations.length === 0) {
    return `
      <div class="reservation-section-container lodging-section">
        <div class="reservation-section-header">
          <span class="section-icon">🏨</span>
          <h3>${t('reservations.lodging')}</h3>
        </div>
        <div class="reservation-empty-state">
          <p>${t('reservations.noLodging')}</p>
          <button class="btn btn-sm btn-secondary" data-action="add-lodging">
            + ${t('reservations.addLodging')}
          </button>
        </div>
      </div>
    `;
  }

  // Sort by start time
  lodgingReservations.sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  const cards = lodgingReservations.map(r => createReservationCard(r)).join('');

  return `
    <div class="reservation-section-container lodging-section">
      <div class="reservation-section-header">
        <span class="section-icon">🏨</span>
        <h3>${t('reservations.lodging')}</h3>
        <button class="btn btn-sm btn-secondary" data-action="add-lodging">
          + ${t('common.add')}
        </button>
      </div>
      <div class="reservation-section-cards">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Create the Transport section
 * Note: Transport reservations have been replaced by simple 'transit' activities.
 * Transit stops are now regular activities in the timeline, not reservation cards.
 * This function returns an empty string as the transport section is no longer used.
 * @param {Array} activities - All activities
 * @returns {string} Empty string (section removed)
 */
export function createTransportationSection(activities) {
  // Transport section removed - transit stops are now regular activities
  return '';
}

/**
 * Create the Dining section
 * Types: Bar, Restaurant (alphabetically sorted)
 * @param {Array} activities - All activities
 * @returns {string} HTML string
 */
export function createDiningEventsSection(activities) {
  const diningTypes = ['bar', 'restaurant'];
  const diningReservations = filterReservationsByType(activities, diningTypes);

  if (diningReservations.length === 0) {
    return `
      <div class="reservation-section-container dining-section">
        <div class="reservation-section-header">
          <span class="section-icon">🍽️</span>
          <h3>${t('reservations.dining')}</h3>
        </div>
        <div class="reservation-empty-state">
          <p>${t('reservations.noDining')}</p>
          <button class="btn btn-sm btn-secondary" data-action="add-dining">
            + ${t('reservations.addDining')}
          </button>
        </div>
      </div>
    `;
  }

  // Sort by start time
  diningReservations.sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  const cards = diningReservations.map(r => createReservationCard(r)).join('');

  return `
    <div class="reservation-section-container dining-section">
      <div class="reservation-section-header">
        <span class="section-icon">🍽️</span>
        <h3>${t('reservations.dining')}</h3>
        <button class="btn btn-sm btn-secondary" data-action="add-dining">
          + ${t('common.add')}
        </button>
      </div>
      <div class="reservation-section-cards">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Create a collapsible reservation card with inline editing
 * @param {Object} reservation - Reservation/activity data
 * @returns {string} HTML string
 */
function createReservationCard(reservation) {
  const {
    id,
    type,
    title,
    location,
    startTime,
    endTime,
    metadata = {},
  } = reservation;

  const icon = getTypeIcon(type);
  const fields = getEditableFields(type, reservation);

  return `
    <div class="inline-reservation-card" data-id="${id}" data-type="${type}">
      <div class="inline-reservation-header" data-action="toggle-expand">
        <span class="inline-reservation-icon">${icon}</span>
        <span class="inline-reservation-title" data-field="title" data-value="${escapeAttr(title)}">${escapeHtml(title)}</span>
        <span class="inline-reservation-header-spacer"></span>
        <span class="inline-reservation-chevron">▶</span>
        <button class="btn-icon-sm inline-reservation-delete" data-action="delete-reservation" data-id="${id}" title="${t('common.delete')}" aria-label="${t('common.delete')}">
          🗑️
        </button>
      </div>
      <div class="inline-reservation-details" style="display: none;">
        ${fields}
      </div>
    </div>
  `;
}

// Type categories for filtering dropdown options (icons only, labels come from i18n)
// Note: Transport types removed - transit stops are now regular activities
const TYPE_CATEGORIES = {
  lodging: [
    { value: 'hotel', icon: '🏨' },
    { value: 'rental', icon: '🏠' },
  ],
  dining: [
    { value: 'bar', icon: '🍸' },
    { value: 'restaurant', icon: '🍽️' },
  ],
};

/**
 * Get translated label for reservation type
 * T036: Now uses category resolver for custom categories
 */
function getTypeLabel(type) {
  const icon = getCategoryIcon(type, 'reservation');
  const name = getCategoryName(type, 'reservation');
  return `${icon} ${name}`;
}

/**
 * Get the category for a given type
 * Note: Transport types removed - transit stops are now regular activities
 * @param {string} type - Reservation type
 * @returns {string} Category name
 */
function getCategoryForType(type) {
  if (['hotel', 'rental'].includes(type)) return 'lodging';
  if (['bar', 'restaurant'].includes(type)) return 'dining';
  return 'lodging'; // default fallback
}

/**
 * Create reservation type dropdown field
 * T034: Updated to use dynamic categories from category resolver
 * @param {string} currentType - Current reservation type value (key or custom:uuid)
 * @returns {string} HTML string
 */
function createReservationTypeField(currentType) {
  // Get the sub-category for the current type (lodging/transport/dining)
  // and only show types from that sub-category
  const subCategory = getCategoryForType(currentType);

  // T034: Build options from category resolver (includes defaults + custom)
  const categories = getCategoriesState();

  // Use correct signature: buildCategoryOptions(domain, defaults, custom)
  // categories.defaults and categories.custom are objects keyed by domain
  const defaults = categories?.defaults?.reservation || [];
  const custom = categories?.custom?.reservation || [];
  const allCategoryOptions = buildCategoryOptions('reservation', defaults, custom);

  // Map default keys to their sub-categories for filtering
  const defaultSubCategories = {
    hotel: 'lodging', rental: 'lodging',
    bus: 'transport', car: 'transport', cruise: 'transport',
    ferry: 'transport', flight: 'transport', train: 'transport',
    bar: 'dining', restaurant: 'dining',
  };

  // Extract flat defaults and custom options from the buildCategoryOptions result
  const flatDefaults = [];
  const flatCustom = [];

  allCategoryOptions.forEach(item => {
    if (item.groupLabel) {
      // This is a grouped set (reservation groups or custom categories)
      item.options.forEach(opt => {
        if (opt.isCustom) {
          flatCustom.push(opt);
        } else {
          flatDefaults.push(opt);
        }
      });
    } else {
      // Flat option (shouldn't happen for reservations, but handle it)
      if (item.isCustom) {
        flatCustom.push(item);
      } else {
        flatDefaults.push(item);
      }
    }
  });

  // Filter to only show types from the current sub-category
  const filteredDefaults = flatDefaults.filter(opt => {
    return defaultSubCategories[opt.value] === subCategory;
  });

  // Custom categories apply to all reservation sub-categories
  const filteredCustom = flatCustom;

  const currentLabel = getTypeLabel(currentType);

  // Build option HTML
  let optionsHtml = '';

  // Default categories for this sub-category
  if (filteredDefaults.length > 0) {
    optionsHtml += `<optgroup label="${t('settings.tripCategories.defaultCategories')}">`;
    filteredDefaults.forEach(opt => {
      optionsHtml += `<option value="${opt.value}" ${opt.value === currentType ? 'selected' : ''}>${opt.icon} ${opt.label}</option>`;
    });
    optionsHtml += '</optgroup>';
  }

  // Custom categories
  if (filteredCustom.length > 0) {
    optionsHtml += `<optgroup label="${t('settings.tripCategories.customCategories')}">`;
    filteredCustom.forEach(opt => {
      optionsHtml += `<option value="${opt.value}" ${opt.value === currentType ? 'selected' : ''}>${opt.icon} ${opt.label}</option>`;
    });
    optionsHtml += '</optgroup>';
  }

  return `
    <div class="inline-edit-field" data-field="type" data-type="select">
      <span class="inline-edit-label">${t('activity.type')}</span>
      <span class="inline-edit-value" data-action="start-edit" data-value="${escapeAttr(currentType)}">
        ${escapeHtml(currentLabel)}
      </span>
      <select class="inline-edit-input inline-edit-select" style="display: none;">
        ${optionsHtml}
      </select>
    </div>
  `;
}

/**
 * Get editable fields HTML based on reservation type
 * @param {string} type - Reservation type
 * @param {Object} reservation - Reservation data
 * @returns {string} HTML string
 */
function getEditableFields(type, reservation) {
  const { metadata = {}, location, startTime, endTime, description, latitude, longitude } = reservation;
  const fields = [];

  // Date constraints from trip
  const dateOpts = { min: tripDateConstraints.minDate, max: tripDateConstraints.maxDate };

  // Reservation Type dropdown (first field, allows changing type)
  fields.push(createReservationTypeField(type));

  // Type-specific fields
  switch (type) {
    // ===== LODGING TYPES =====
    case 'hotel':
      fields.push(createEditableField('propertyName', t('reservations.fields.hotelName'), metadata.propertyName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('checkInDate', t('reservations.fields.checkInDate'), metadata.checkInDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('checkOutDate', t('reservations.fields.checkOutDate'), metadata.checkOutDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    case 'rental':
      fields.push(createEditableField('propertyName', t('reservations.fields.propertyName'), metadata.propertyName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.rentalProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('checkInDate', t('reservations.fields.checkInDate'), metadata.checkInDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('checkOutDate', t('reservations.fields.checkOutDate'), metadata.checkOutDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    // ===== DINING TYPES =====
    case 'bar':
      fields.push(createEditableField('venueName', t('reservations.fields.barName'), metadata.venueName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('reservationDate', t('reservations.fields.reservationDate'), metadata.reservationDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('reservationTime', t('reservations.fields.reservationTime'), metadata.reservationTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('partySize', t('reservations.fields.partySize'), metadata.partySize || '', 'number'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    case 'restaurant':
      fields.push(createEditableField('venueName', t('reservations.fields.restaurantName'), metadata.venueName || metadata.restaurantName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('reservationDate', t('reservations.fields.reservationDate'), metadata.reservationDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('reservationTime', t('reservations.fields.reservationTime'), metadata.reservationTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('partySize', t('reservations.fields.partySize'), metadata.partySize || '', 'number'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    default:
      // Generic fallback for unknown types
      fields.push(createEditableField('provider', t('reservations.fields.providerCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('startDate', t('trip.startDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('endDate', t('trip.endDate'), extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;
  }

  // Notes/Description field (common to all, shown last)
  fields.push(createEditableField('description', t('reservations.fields.notes'), description || '', 'textarea'));

  // Save/Cancel buttons
  const actionButtons = `
    <div class="inline-card-actions">
      <button type="button" class="btn btn-sm btn-secondary inline-card-cancel">${t('common.cancel')}</button>
      <button type="button" class="btn btn-sm btn-primary inline-card-save">${t('common.save')}</button>
    </div>
  `;

  return `<div class="inline-reservation-fields">${fields.join('')}${actionButtons}</div>`;
}

/**
 * Create location field with Nominatim search and manual coordinates option
 * @param {string} label - Field label
 * @param {string} location - Location text
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {string} HTML string
 */
function createLocationField(label, location, latitude, longitude) {
  const hasCoordinates = latitude && longitude;
  const coordsText = hasCoordinates ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : '';
  const isEmpty = !location;
  const addPlaceholder = t('itinerary.addField', { field: label.toLowerCase() });

  return `
    <div class="inline-edit-field inline-edit-field-location" data-field="location" data-type="location">
      <span class="inline-edit-label">${label}</span>
      <div class="inline-location-display">
        <span class="inline-edit-value ${isEmpty ? 'empty' : ''}" data-action="start-location-edit" data-value="${escapeAttr(location || '')}">
          ${isEmpty ? addPlaceholder : escapeHtml(location)}
        </span>
        ${hasCoordinates ? `<span class="inline-location-coords">📍 ${coordsText}</span>` : ''}
      </div>
      <div class="inline-location-editor" style="display: none;">
        <div class="inline-location-search-wrapper">
          <input
            type="text"
            class="inline-edit-input inline-location-input"
            value="${escapeAttr(location || '')}"
            placeholder="${t('itinerary.searchPlace')}"
            autocomplete="off"
          />
          <div class="inline-location-search-indicator" style="display: none;">
            <span class="spinner-small"></span>
          </div>
          <div class="inline-location-suggestions" style="display: none;"></div>
        </div>
        <div class="inline-location-hint">
          ${hasCoordinates ? `📍 ${t('itinerary.coordinates')}: ${coordsText}` : t('itinerary.startTypingLocation')}
        </div>
        <div class="inline-manual-coords-toggle">
          <label class="form-checkbox-label">
            <input type="checkbox" class="inline-manual-coords-checkbox" ${hasCoordinates ? 'checked' : ''} />
            <span>${t('itinerary.enterCoordsManually')}</span>
          </label>
        </div>
        <div class="inline-manual-coords-section" style="display: ${hasCoordinates ? 'block' : 'none'};">
          <div class="inline-coords-row">
            <div class="inline-coord-field">
              <label>${t('itinerary.latitude')}</label>
              <input type="number" class="inline-edit-input inline-lat-input" value="${latitude || ''}" step="any" min="-90" max="90" placeholder="${t('itinerary.latitudePlaceholder')}" />
            </div>
            <div class="inline-coord-field">
              <label>${t('itinerary.longitude')}</label>
              <input type="number" class="inline-edit-input inline-lng-input" value="${longitude || ''}" step="any" min="-180" max="180" placeholder="${t('itinerary.longitudePlaceholder')}" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create a single editable field
 * @param {string} fieldName - Field name for data attribute
 * @param {string} label - Display label
 * @param {string} value - Current value
 * @param {string} inputType - Input type (text, date, time, number, textarea)
 * @param {Object} options - Optional constraints { min, max }
 * @returns {string} HTML string
 */
function createEditableField(fieldName, label, value, inputType, options = {}) {
  const displayValue = formatDisplayValue(value, inputType);
  const isEmpty = !value && value !== 0;
  const addPlaceholder = t('itinerary.addField', { field: label.toLowerCase() });

  // Build min/max attributes
  let constraintAttrs = '';
  if (inputType === 'number') {
    constraintAttrs = `min="${options.min || 1}" max="${options.max || 100}"`;
  } else if (inputType === 'date' || inputType === 'datetime-local') {
    const minAttr = options.min ? `min="${options.min}"` : '';
    const maxAttr = options.max ? `max="${options.max}"` : '';
    constraintAttrs = `${minAttr} ${maxAttr}`.trim();
  }

  // Use textarea for description/notes
  if (inputType === 'textarea') {
    return `
      <div class="inline-edit-field inline-edit-field-textarea" data-field="${fieldName}" data-type="${inputType}">
        <span class="inline-edit-label">${label}</span>
        <span class="inline-edit-value ${isEmpty ? 'empty' : ''}" data-action="start-edit" data-value="${escapeAttr(value)}">
          ${isEmpty ? addPlaceholder : escapeHtml(displayValue)}
        </span>
        <textarea
          class="inline-edit-input inline-edit-textarea"
          style="display: none;"
          rows="3"
        >${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  return `
    <div class="inline-edit-field" data-field="${fieldName}" data-type="${inputType}">
      <span class="inline-edit-label">${label}</span>
      <span class="inline-edit-value ${isEmpty ? 'empty' : ''}" data-action="start-edit" data-value="${escapeAttr(value)}">
        ${isEmpty ? addPlaceholder : escapeHtml(displayValue)}
      </span>
      <input
        type="${inputType}"
        class="inline-edit-input"
        value="${escapeAttr(value)}"
        ${constraintAttrs}
        style="display: none;"
      />
    </div>
  `;
}

/**
 * Format value for display based on type
 * Uses preference-aware formatting from date-helpers.js
 */
function formatDisplayValue(value, type) {
  if (!value && value !== 0) return '';

  if (type === 'date' && value) {
    try {
      const date = new Date(value + 'T12:00:00Z');
      return formatDateLocale(date, 'medium');
    } catch {
      return value;
    }
  }

  if (type === 'time' && value) {
    try {
      const [hours, minutes] = value.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return formatTimeLocale(date);
    } catch {
      return value;
    }
  }

  return String(value);
}

/**
 * Get icon for reservation type
 * T036: Now uses category resolver for custom categories
 */
function getTypeIcon(type) {
  return getCategoryIcon(type, 'reservation');
}

/**
 * Extract date from ISO string
 */
function extractDate(isoString) {
  if (!isoString) return '';
  try {
    return isoString.split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Extract time from ISO string
 */
function extractTime(isoString) {
  if (!isoString) return '';
  try {
    const timePart = isoString.split('T')[1];
    if (timePart) {
      return timePart.substring(0, 5);
    }
  } catch {
    // Ignore
  }
  return '';
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape attribute value
 */
function escapeAttr(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Search Nominatim for locations
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of location results
 */
async function searchNominatim(query) {
  if (!query || query.length < 3) {
    return [];
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastNominatimRequest;
  if (timeSinceLastRequest < NOMINATIM_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, NOMINATIM_RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastNominatimRequest = Date.now();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '5',
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: {
        'User-Agent': 'OpenTripBoard/1.0 (travel planning app)',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.map(item => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
      address: item.address,
    }));
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

// Store the current document click handler so we can remove it
let currentDocClickHandler = null;

/**
 * Attach event listeners to reservation sections
 * @param {HTMLElement} container - Container element
 * @param {Object} handlers - Event handlers
 */
export function attachReservationSectionListeners(container, handlers) {
  const { onAddLodging, onAddDiningEvent, onSave, onDelete, onTypeChange, onSaveComplete } = handlers;

  // Add lodging buttons (could be in header or empty state)
  container.querySelectorAll('[data-action="add-lodging"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAddLodging?.();
    });
  });

  // Add dining/event buttons
  container.querySelectorAll('[data-action="add-dining"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAddDiningEvent?.();
    });
  });

  // Handle all reservation cards
  container.querySelectorAll('.inline-reservation-card').forEach(card => {
    setupReservationCard(card, container, onSave, onDelete, onTypeChange, onSaveComplete);
  });

  // Remove previous document click handler if exists
  if (currentDocClickHandler) {
    document.removeEventListener('click', currentDocClickHandler);
  }

  // Click outside any expanded card to save and collapse
  currentDocClickHandler = (e) => {
    const expandedCards = container.querySelectorAll('.inline-reservation-card.expanded');
    expandedCards.forEach(card => {
      // Check if click is outside this card
      if (!card.contains(e.target)) {
        const reservationId = card.dataset.id;
        const reservationType = card.dataset.type;
        const pendingChanges = card._pendingChanges;

        if (pendingChanges && pendingChanges.size > 0) {
          saveAllPendingChanges(card, pendingChanges, reservationId, reservationType, onSave, onTypeChange, onSaveComplete);
        }

        // Collapse the card
        collapseCard(card);
      }
    });
  };
  document.addEventListener('click', currentDocClickHandler);
}

/**
 * Setup a single reservation card with all its event handlers
 */
function setupReservationCard(card, container, onSave, onDelete, onTypeChange, onSaveComplete) {
  const reservationId = card.dataset.id;
  const reservationType = card.dataset.type;

  // Store pending changes on the card element
  card._pendingChanges = new Map();

  // Toggle expand/collapse
  const header = card.querySelector('.inline-reservation-header');
  header?.addEventListener('click', (e) => {
    // Don't toggle if clicking delete button
    if (e.target.closest('[data-action="delete-reservation"]')) return;

    const isExpanded = card.classList.contains('expanded');

    // Collapse all other cards first
    container.querySelectorAll('.inline-reservation-card').forEach(otherCard => {
      if (otherCard !== card) {
        collapseCard(otherCard);
      }
    });

    // Toggle current card
    if (isExpanded) {
      collapseCard(card);
    } else {
      expandCard(card);
    }
  });

  // Delete button
  card.querySelector('[data-action="delete-reservation"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete?.(reservationId);
  });

  // Save button
  card.querySelector('.inline-card-save')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await saveAllPendingChanges(card, card._pendingChanges, reservationId, reservationType, onSave, onTypeChange, onSaveComplete);
  });

  // Cancel button
  card.querySelector('.inline-card-cancel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelAllPendingChanges(card, card._pendingChanges);
    collapseCard(card);
  });

  // Setup field editing
  card.querySelectorAll('.inline-edit-field:not(.inline-edit-field-location)').forEach(field => {
    setupFieldEditing(field, card);
  });

  // Location field (has its own save/cancel buttons, tracks to pending changes)
  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField) {
    attachLocationFieldListeners(locationField, reservationId, reservationType, onSave, card._pendingChanges);
  }

  // Title editing
  const titleSpan = card.querySelector('.inline-reservation-title');
  if (titleSpan) {
    const originalTitle = titleSpan.dataset.value || titleSpan.textContent;
    titleSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      startTitleEditingWithPending(card, titleSpan, card._pendingChanges, originalTitle);
    });
  }
}

/**
 * Setup editing for a single field
 */
function setupFieldEditing(field, card) {
  const fieldName = field.dataset.field;
  const fieldType = field.dataset.type;
  const valueSpan = field.querySelector('.inline-edit-value');
  const input = field.querySelector('.inline-edit-input');

  if (!valueSpan || !input) return;

  const originalValue = valueSpan.dataset.value || '';

  // Click to start editing
  valueSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    startEditing(field, valueSpan, input);
  });

  // For select elements, track change
  if (fieldType === 'select') {
    input.addEventListener('change', () => {
      const newValue = input.value;
      const selectedOption = input.options[input.selectedIndex];
      valueSpan.textContent = selectedOption ? selectedOption.textContent : newValue;
      valueSpan.dataset.value = newValue;
      card._pendingChanges.set(fieldName, { newValue, originalValue, field, valueSpan, input, fieldType });
      field.classList.remove('editing');
      input.style.display = 'none';
      valueSpan.style.display = 'block';
    });
  }

  // Track change on blur
  input.addEventListener('blur', () => {
    const newValue = input.value;
    field.classList.remove('editing');
    input.style.display = 'none';
    valueSpan.style.display = 'block';

    if (fieldType === 'select') {
      const selectedOption = input.options[input.selectedIndex];
      valueSpan.textContent = selectedOption ? selectedOption.textContent : newValue;
    } else {
      const displayValue = formatDisplayValue(newValue, fieldType);
      valueSpan.textContent = newValue ? displayValue : t('itinerary.addField', { field: field.querySelector('.inline-edit-label')?.textContent.toLowerCase() || 'value' });
      valueSpan.classList.toggle('empty', !newValue);
    }
    valueSpan.dataset.value = newValue;

    if (newValue !== originalValue) {
      card._pendingChanges.set(fieldName, { newValue, originalValue, field, valueSpan, input, fieldType });
    } else {
      card._pendingChanges.delete(fieldName);
    }
  });

  // Escape to close field (not cancel all)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = valueSpan.dataset.value || '';
      input.blur();
    }
  });
}

/**
 * Expand a card
 */
function expandCard(card) {
  const details = card.querySelector('.inline-reservation-details');
  const chevron = card.querySelector('.inline-reservation-chevron');
  if (details) details.style.display = 'block';
  if (chevron) chevron.textContent = '▼';
  card.classList.add('expanded');
}

/**
 * Collapse a card
 */
function collapseCard(card) {
  const details = card.querySelector('.inline-reservation-details');
  const chevron = card.querySelector('.inline-reservation-chevron');
  if (details) details.style.display = 'none';
  if (chevron) chevron.textContent = '▶';
  card.classList.remove('expanded');
}

/**
 * Save all pending changes for a card
 */
async function saveAllPendingChanges(card, pendingChanges, reservationId, reservationType, onSave, onTypeChange, onSaveComplete) {
  if (!onSave || pendingChanges.size === 0) return;

  let typeChanged = false;
  let newType = null;
  let hasError = false;
  const savedChanges = new Map();

  for (const [fieldName, change] of pendingChanges) {
    try {
      // Pass silent: true to suppress individual toasts
      await onSave(reservationId, reservationType, fieldName, change.newValue, { silent: true });
      savedChanges.set(fieldName, change.newValue);
      if (fieldName === 'type') {
        typeChanged = true;
        newType = change.newValue;
      }
    } catch (error) {
      console.error(`Failed to save field ${fieldName}:`, error);
      hasError = true;
      // Revert this field on error
      if (change.valueSpan && change.input) {
        if (change.fieldType === 'select') {
          const oldOption = Array.from(change.input.options).find(opt => opt.value === change.originalValue);
          change.valueSpan.textContent = oldOption ? oldOption.textContent : change.originalValue;
        } else {
          const displayValue = formatDisplayValue(change.originalValue, change.fieldType);
          change.valueSpan.textContent = change.originalValue ? displayValue : t('itinerary.addValue');
        }
        change.valueSpan.dataset.value = change.originalValue;
        change.input.value = change.originalValue;
      }
    }
  }

  pendingChanges.clear();

  // Show a single toast after all saves
  if (hasError) {
    showToast(t('itinerary.someChangesFailed'), 'error');
  } else {
    showToast(t('activity.saved'), 'success');
  }

  // If type changed, trigger refresh
  if (typeChanged && onTypeChange) {
    onTypeChange(reservationId, newType);
  }

  // Notify that save is complete (for reordering, etc.)
  if (onSaveComplete && savedChanges.size > 0) {
    onSaveComplete(reservationId, savedChanges);
  }
}

/**
 * Cancel all pending changes for a card
 */
function cancelAllPendingChanges(card, pendingChanges) {
  for (const [fieldName, change] of pendingChanges) {
    // Skip location-related fields, handled separately
    if (['location', 'latitude', 'longitude'].includes(fieldName)) continue;

    if (change.valueSpan && change.input) {
      // Revert to original value
      if (change.fieldType === 'select') {
        const oldOption = Array.from(change.input.options).find(opt => opt.value === change.originalValue);
        change.valueSpan.textContent = oldOption ? oldOption.textContent : change.originalValue;
      } else {
        const displayValue = formatDisplayValue(change.originalValue, change.fieldType);
        change.valueSpan.textContent = change.originalValue ? displayValue : t('itinerary.addValue');
        change.valueSpan.classList.toggle('empty', !change.originalValue);
      }
      change.valueSpan.dataset.value = change.originalValue;
      change.input.value = change.originalValue;
    }
  }

  // Also revert title if changed
  const titleChange = pendingChanges.get('title');
  if (titleChange) {
    const titleSpan = card.querySelector('.inline-reservation-title');
    if (titleSpan) {
      titleSpan.textContent = titleChange.originalValue;
      titleSpan.dataset.value = titleChange.originalValue;
    }
  }

  // Revert location field if changed
  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField?._locationData) {
    locationField._locationData.revertToOriginal();
  }

  pendingChanges.clear();
}

/**
 * Start title editing with pending changes tracking
 */
function startTitleEditingWithPending(card, titleSpan, pendingChanges, originalTitle) {
  const currentValue = titleSpan.dataset.value || titleSpan.textContent;

  // Create input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-title-input';
  input.value = currentValue;

  // Replace span with input
  titleSpan.style.display = 'none';
  titleSpan.parentNode.insertBefore(input, titleSpan.nextSibling);
  input.focus();
  input.select();

  const finishEdit = () => {
    const newValue = input.value.trim() || currentValue;
    input.remove();
    titleSpan.style.display = '';
    titleSpan.textContent = newValue;
    titleSpan.dataset.value = newValue;

    // Track pending change if different from original
    if (newValue !== originalTitle) {
      pendingChanges.set('title', { newValue, originalValue: originalTitle });
    } else {
      pendingChanges.delete('title');
    }
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = currentValue;
      input.blur();
    }
  });
}

/**
 * Start editing a field
 */
function startEditing(field, valueSpan, input) {
  field.classList.add('editing');
  valueSpan.style.display = 'none';
  input.style.display = 'block';
  input.focus();
  // Only call select() on text inputs, not on select elements
  if (typeof input.select === 'function' && input.tagName !== 'SELECT') {
    input.select();
  }
}

/**
 * Attach listeners for location field with Nominatim search
 * Now integrates with card-level pendingChanges instead of saving directly
 */
function attachLocationFieldListeners(field, reservationId, reservationType, onSave, pendingChanges) {
  const displaySection = field.querySelector('.inline-location-display');
  const valueSpan = field.querySelector('.inline-edit-value');
  const editor = field.querySelector('.inline-location-editor');
  const locationInput = field.querySelector('.inline-location-input');
  const suggestionsContainer = field.querySelector('.inline-location-suggestions');
  const searchIndicator = field.querySelector('.inline-location-search-indicator');
  const locationHint = field.querySelector('.inline-location-hint');
  const manualCoordsToggle = field.querySelector('.inline-manual-coords-checkbox');
  const manualCoordsSection = field.querySelector('.inline-manual-coords-section');
  const latInput = field.querySelector('.inline-lat-input');
  const lngInput = field.querySelector('.inline-lng-input');
  const coordsSpan = field.querySelector('.inline-location-coords');

  let searchDebounceTimer = null;
  let selectedCoords = {
    latitude: latInput?.value ? parseFloat(latInput.value) : null,
    longitude: lngInput?.value ? parseFloat(lngInput.value) : null,
  };
  const originalLocation = valueSpan?.dataset.value || '';
  const originalCoords = { ...selectedCoords };

  // Store references for the card-level save/cancel to access
  field._locationData = {
    originalLocation,
    originalCoords,
    getCurrentValues: () => ({
      location: locationInput?.value.trim() || '',
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
    }),
    revertToOriginal: () => {
      locationInput.value = originalLocation;
      selectedCoords = { ...originalCoords };
      if (latInput) latInput.value = originalCoords.latitude || '';
      if (lngInput) lngInput.value = originalCoords.longitude || '';
      updateLocationHint();
      valueSpan.textContent = originalLocation || t('itinerary.addLocation');
      valueSpan.dataset.value = originalLocation;
      valueSpan.classList.toggle('empty', !originalLocation);
      if (coordsSpan) {
        if (originalCoords.latitude && originalCoords.longitude) {
          coordsSpan.textContent = `📍 ${originalCoords.latitude.toFixed(6)}, ${originalCoords.longitude.toFixed(6)}`;
          coordsSpan.style.display = '';
        } else {
          coordsSpan.style.display = 'none';
        }
      }
    },
  };

  // Click to start editing
  valueSpan?.addEventListener('click', (e) => {
    e.stopPropagation();
    displaySection.style.display = 'none';
    editor.style.display = 'block';
    locationInput?.focus();
  });

  // Toggle manual coordinates section
  manualCoordsToggle?.addEventListener('change', () => {
    manualCoordsSection.style.display = manualCoordsToggle.checked ? 'block' : 'none';
    if (manualCoordsToggle.checked) {
      // Sync visible inputs with selected coords
      if (selectedCoords.latitude) latInput.value = selectedCoords.latitude;
      if (selectedCoords.longitude) lngInput.value = selectedCoords.longitude;
    }
  });

  // Sync manual input fields to selectedCoords and track pending changes
  latInput?.addEventListener('input', () => {
    selectedCoords.latitude = latInput.value ? parseFloat(latInput.value) : null;
    updateLocationHint();
    trackLocationChange();
  });
  lngInput?.addEventListener('input', () => {
    selectedCoords.longitude = lngInput.value ? parseFloat(lngInput.value) : null;
    updateLocationHint();
    trackLocationChange();
  });

  function updateLocationHint() {
    if (selectedCoords.latitude && selectedCoords.longitude) {
      locationHint.textContent = `📍 ${t('itinerary.coordinates')}: ${selectedCoords.latitude.toFixed(6)}, ${selectedCoords.longitude.toFixed(6)}`;
    } else {
      locationHint.textContent = t('itinerary.startTypingLocation');
    }
  }

  // Track location changes in the card's pendingChanges
  function trackLocationChange() {
    const newLocation = locationInput?.value.trim() || '';
    const newLat = selectedCoords.latitude;
    const newLng = selectedCoords.longitude;

    const locationChanged = newLocation !== originalLocation;
    const coordsChanged = newLat !== originalCoords.latitude || newLng !== originalCoords.longitude;

    if (locationChanged || coordsChanged) {
      // Store all location-related changes together
      pendingChanges.set('location', {
        newValue: newLocation,
        originalValue: originalLocation,
        fieldType: 'location',
      });
      if (coordsChanged) {
        pendingChanges.set('latitude', {
          newValue: newLat,
          originalValue: originalCoords.latitude,
          fieldType: 'number',
        });
        pendingChanges.set('longitude', {
          newValue: newLng,
          originalValue: originalCoords.longitude,
          fieldType: 'number',
        });
      }
    } else {
      pendingChanges.delete('location');
      pendingChanges.delete('latitude');
      pendingChanges.delete('longitude');
    }
  }

  // Close editor and update display (called when clicking outside editor but inside card)
  function closeEditor() {
    const newLocation = locationInput?.value.trim() || '';
    const newLat = selectedCoords.latitude;
    const newLng = selectedCoords.longitude;

    // Update display to show current (possibly changed) values
    valueSpan.textContent = newLocation || t('itinerary.addLocation');
    valueSpan.dataset.value = newLocation;
    valueSpan.classList.toggle('empty', !newLocation);

    if (coordsSpan) {
      if (newLat && newLng) {
        coordsSpan.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
        coordsSpan.style.display = '';
      } else {
        coordsSpan.style.display = 'none';
      }
    } else if (newLat && newLng) {
      const newCoordsSpan = document.createElement('span');
      newCoordsSpan.className = 'inline-location-coords';
      newCoordsSpan.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
      displaySection.appendChild(newCoordsSpan);
    }

    // Track the change
    trackLocationChange();

    suggestionsContainer.style.display = 'none';
    editor.style.display = 'none';
    displaySection.style.display = 'block';
  }

  // Location search with debounce
  locationInput?.addEventListener('input', () => {
    const query = locationInput.value.trim();

    // Clear previous timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Hide suggestions if query is too short
    if (query.length < 3) {
      suggestionsContainer.style.display = 'none';
      suggestionsContainer.innerHTML = '';
      return;
    }

    // Debounce search
    searchDebounceTimer = setTimeout(async () => {
      searchIndicator.style.display = 'flex';

      const results = await searchNominatim(query);

      searchIndicator.style.display = 'none';

      if (results.length > 0) {
        suggestionsContainer.innerHTML = results.map((result, index) => `
          <div class="inline-location-suggestion" data-index="${index}">
            <div class="inline-location-suggestion-name">${escapeHtml(truncateText(result.displayName, 80))}</div>
            <div class="inline-location-suggestion-coords">📍 ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}</div>
          </div>
        `).join('');
        suggestionsContainer.style.display = 'block';

        // Attach click handlers to suggestions
        suggestionsContainer.querySelectorAll('.inline-location-suggestion').forEach((el, index) => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const result = results[index];
            selectLocation(result);
          });
        });
      } else {
        suggestionsContainer.innerHTML = `
          <div class="inline-location-suggestion-empty">
            ${t('itinerary.noLocationsFound')}
          </div>
        `;
        suggestionsContainer.style.display = 'block';
      }
    }, 500);
  });

  // Select a location from suggestions
  function selectLocation(result) {
    locationInput.value = result.displayName.split(',')[0]; // Use first part of name
    selectedCoords.latitude = result.latitude;
    selectedCoords.longitude = result.longitude;

    // Also fill visible inputs in case user opens the section
    if (latInput) latInput.value = result.latitude;
    if (lngInput) lngInput.value = result.longitude;

    updateLocationHint();
    suggestionsContainer.style.display = 'none';

    // Track the change
    trackLocationChange();
  }

  // Close editor when clicking outside of it (but still in the card)
  // The card-level click-outside handler will save when clicking outside the card
  editor?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card header toggle
  });

  // Close suggestions when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!field.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
      // If editor is open and click is outside field, close it
      if (editor?.style.display !== 'none') {
        closeEditor();
      }
    }
  });
}

export default {
  createLodgingSection,
  createTransportationSection,
  createDiningEventsSection,
  attachReservationSectionListeners,
};
