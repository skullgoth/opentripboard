// T072: ItineraryTimeline component - day-by-day view with drop zones
// Updated: Inline editing with expand/collapse and Nominatim location search
// T033/T036: Updated to use category resolver for dynamic activity types
import { formatDate, formatTime, formatDateTimeForInput } from '../utils/date-helpers.js';
import { formatDate as formatDateShort, formatTime as formatTimePreference, formatDateTime as formatDateTimePreference } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';
import { getCategoryIcon, getCategoryName, buildCategoryOptions } from '../utils/category-resolver.js';
import { getCategories as getCategoriesState } from '../state/categories-state.js';

// Nominatim API configuration
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const NOMINATIM_RATE_LIMIT_MS = 1100; // 1 request per second + buffer
let lastNominatimRequest = 0;

/**
 * Create itinerary timeline component
 * @param {Array} activities - Array of activity objects
 * @param {Object} trip - Trip object
 * @returns {string} HTML string
 */
export function createItineraryTimeline(activities, trip) {
  if (!activities || activities.length === 0) {
    return `
      <div class="itinerary-timeline empty-state">
        <div class="empty-state-content">
          <h3>${t('trip.noActivities')}</h3>
          <p>${t('itinerary.addFirstActivity')}</p>
          <button class="btn btn-sm btn-primary" data-action="add-activity">
            ${t('trip.addActivity')}
          </button>
        </div>
      </div>
    `;
  }

  // Group activities by day
  const activitiesByDay = groupActivitiesByDay(activities, trip);

  const dayGroups = Object.entries(activitiesByDay)
    .sort(([dateA], [dateB]) => {
      // Keep 'zzz-undated' at the end
      if (dateA === 'zzz-undated') return 1;
      if (dateB === 'zzz-undated') return -1;
      return dateA.localeCompare(dateB);
    })
    .map(([date, dayActivities]) => {
      const activitiesHtml = dayActivities
        .map(
          (activity) => `
        <div class="activity-card"
             data-activity-id="${activity.id}"
             data-activity-type="${activity.type}"
             data-order-index="${activity.orderIndex}">
          ${createActivityCardContent(activity)}
        </div>
      `
        )
        .join('');

      // Special handling for undated activities - don't show date header
      if (date === 'zzz-undated') {
        return `
          <div class="timeline-day undated" data-date="${date}">
            <div class="timeline-day-activities" data-drop-zone="${date}">
              ${activitiesHtml}
            </div>
          </div>
        `;
      }

      return `
        <div class="timeline-day" data-date="${date}">
          <div class="timeline-day-header">
            <h3 class="timeline-day-title">${formatDate(date, 'full')}</h3>
            <button class="btn btn-sm btn-secondary" data-action="add-activity" data-date="${date}">
              + ${t('trip.addActivity')}
            </button>
          </div>
          <div class="timeline-day-activities" data-drop-zone="${date}">
            ${activitiesHtml}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="itinerary-timeline">
      <div class="timeline-header">
        <h2>${t('trip.itinerary')}</h2>
      </div>
      <div class="timeline-content">
        ${dayGroups}
      </div>
    </div>
  `;
}

/**
 * Create activity card content with inline editing support
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
function createActivityCardContent(activity) {
  // T036: Use category resolver for activity type icons (supports custom categories)
  const icon = getCategoryIcon(activity.type, 'activity');
  const hasCoordinates = activity.latitude && activity.longitude;
  const coordsText = hasCoordinates ? `${activity.latitude.toFixed(6)}, ${activity.longitude.toFixed(6)}` : '';

  // Generate editable fields based on activity data
  const fields = getActivityEditableFields(activity);

  return `
    <div class="activity-card-content">
      <div class="activity-card-header" data-action="toggle-expand">
        <span class="activity-icon">${icon}</span>
        <span class="activity-title" data-field="title" data-value="${escapeAttr(activity.title)}">${escapeHtml(activity.title)}</span>
        <span class="activity-header-spacer"></span>
        <span class="activity-drag-handle" title="${t('itinerary.dragToReorder')}">⠿</span>
        <span class="activity-chevron">▶</span>
        <div class="activity-actions">
          <button class="btn-icon-sm" data-action="delete-activity" data-activity-id="${activity.id}" title="${t('common.delete')}">
            🗑️
          </button>
        </div>
      </div>
      <div class="activity-card-details" style="display: none;">
        <div class="activity-fields">
          ${fields}
        </div>
      </div>
    </div>
  `;
}

/**
 * Get editable fields HTML for an activity
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
function getActivityEditableFields(activity) {
  const { type, location, startTime, endTime, description, latitude, longitude } = activity;
  const fields = [];

  // Activity Type (dropdown)
  fields.push(createTypeField(type));

  // Start Time
  fields.push(createEditableField('startTime', t('activity.startTime'), formatDateTimeForInput(startTime) || '', 'datetime-local'));

  // End Time
  fields.push(createEditableField('endTime', t('activity.endTime'), formatDateTimeForInput(endTime) || '', 'datetime-local'));

  // Location with Nominatim search
  fields.push(createLocationField(t('activity.location'), location, latitude, longitude));

  // Description
  fields.push(createEditableField('description', t('activity.description'), description || '', 'textarea'));

  // Save/Cancel buttons
  const actionButtons = `
    <div class="inline-card-actions">
      <button type="button" class="btn btn-sm btn-secondary inline-card-cancel">${t('common.cancel')}</button>
      <button type="button" class="btn btn-sm btn-primary inline-card-save">${t('common.save')}</button>
    </div>
  `;

  return fields.join('') + actionButtons;
}

/**
 * Create activity type dropdown field
 * T033: Updated to use dynamic categories from category resolver
 * @param {string} currentType - Current activity type value (key or custom:uuid)
 * @returns {string} HTML string
 */
function createTypeField(currentType) {
  // T033: Build options from category resolver (includes defaults + custom)
  const categories = getCategoriesState();

  // Use correct signature: buildCategoryOptions(domain, defaults, custom)
  // categories.defaults and categories.custom are objects keyed by domain
  const defaults = categories?.defaults?.activity || [];
  const custom = categories?.custom?.activity || [];
  const categoryOptions = buildCategoryOptions('activity', defaults, custom);

  // Get current type display info
  const currentIcon = getCategoryIcon(currentType, 'activity');
  const currentName = getCategoryName(currentType, 'activity');
  const currentLabel = `${currentIcon} ${currentName}`;

  // Build option HTML from the flat array with potential optgroups
  let optionsHtml = '';

  categoryOptions.forEach(item => {
    if (item.groupLabel) {
      // This is an optgroup (e.g., custom categories)
      optionsHtml += `<optgroup label="${item.groupLabel}">`;
      item.options.forEach(opt => {
        optionsHtml += `<option value="${opt.value}" ${opt.value === currentType ? 'selected' : ''}>${opt.icon} ${opt.label}</option>`;
      });
      optionsHtml += '</optgroup>';
    } else {
      // This is a flat option (defaults without groups)
      optionsHtml += `<option value="${item.value}" ${item.value === currentType ? 'selected' : ''}>${item.icon} ${item.label}</option>`;
    }
  });

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
 * Create a single editable field
 * @param {string} fieldName - Field name for data attribute
 * @param {string} label - Display label
 * @param {string} value - Current value
 * @param {string} inputType - Input type (text, date, time, datetime-local, number, textarea)
 * @returns {string} HTML string
 */
function createEditableField(fieldName, label, value, inputType) {
  const displayValue = formatDisplayValue(value, inputType);
  const isEmpty = !value && value !== 0;
  const addPlaceholder = t('itinerary.addField', { field: label.toLowerCase() });

  // Use textarea for description
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
        style="display: none;"
      />
    </div>
  `;
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
 * Format value for display based on type (preference-aware)
 */
function formatDisplayValue(value, type) {
  if (!value && value !== 0) return '';

  if (type === 'date' && value) {
    try {
      const date = new Date(value + 'T12:00:00Z');
      return formatDateShort(date);
    } catch {
      return value;
    }
  }

  if (type === 'time' && value) {
    try {
      const [hours, minutes] = value.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return formatTimePreference(date);
    } catch {
      return value;
    }
  }

  if (type === 'datetime-local' && value) {
    try {
      const date = new Date(value);
      return formatDateTimePreference(date);
    } catch {
      return value;
    }
  }

  return String(value);
}

/**
 * Group activities by day
 * @param {Array} activities - Array of activities
 * @param {Object} trip - Trip object
 * @returns {Object} Activities grouped by date
 */
function groupActivitiesByDay(activities, trip) {
  const scheduled = {};
  const undated = [];

  // Initialize all dates in the trip's date range with empty arrays
  if (trip.startDate && trip.endDate) {
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);

    // Iterate through each day in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      scheduled[dateKey] = [];
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Place activities into their respective days
  activities.forEach((activity) => {
    if (activity.startTime) {
      const date = new Date(activity.startTime);
      const dateKey = date.toISOString().split('T')[0];

      if (!scheduled[dateKey]) {
        // Activity is outside trip date range, still show it
        scheduled[dateKey] = [];
      }

      scheduled[dateKey].push(activity);
    } else {
      // Activities without start time go into undated list
      undated.push(activity);
    }
  });

  // Sort activities within each day by order index and start time
  Object.keys(scheduled).forEach((dateKey) => {
    scheduled[dateKey].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) {
        return a.orderIndex - b.orderIndex;
      }
      if (a.startTime && b.startTime) {
        return new Date(a.startTime) - new Date(b.startTime);
      }
      return 0;
    });
  });

  // Sort undated activities by order index
  undated.sort((a, b) => a.orderIndex - b.orderIndex);

  // Add undated activities to the end with a special key
  if (undated.length > 0) {
    scheduled['zzz-undated'] = undated;
  }

  return scheduled;
}

// Store the current document click handler so we can remove it
let currentTimelineDocClickHandler = null;

/**
 * Attach timeline listeners with inline editing support
 * @param {HTMLElement} container - Timeline container
 * @param {Object} callbacks - Event callbacks
 */
export function attachTimelineListeners(container, callbacks) {
  const { onAddActivity, onEditActivity, onDeleteActivity, onReorder, onSaveActivity } = callbacks;

  // Add activity buttons
  container.querySelectorAll('[data-action="add-activity"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const date = btn.getAttribute('data-date');
      if (onAddActivity) onAddActivity(date);
    });
  });

  // Handle all activity cards
  container.querySelectorAll('.activity-card').forEach(card => {
    setupActivityCard(card, container, onSaveActivity, onDeleteActivity);
  });

  // Remove previous document click handler if exists
  if (currentTimelineDocClickHandler) {
    document.removeEventListener('click', currentTimelineDocClickHandler);
  }

  // Click outside any expanded card to save and collapse
  currentTimelineDocClickHandler = (e) => {
    const expandedCards = container.querySelectorAll('.activity-card.expanded');
    expandedCards.forEach(card => {
      if (!card.contains(e.target)) {
        const activityId = card.dataset.activityId;
        const pendingChanges = card._pendingChanges;

        if (pendingChanges && pendingChanges.size > 0) {
          saveAllActivityChanges(card, pendingChanges, activityId, onSaveActivity);
        }

        collapseActivityCard(card);
      }
    });
  };
  document.addEventListener('click', currentTimelineDocClickHandler);
}

/**
 * Setup a single activity card with all its event handlers
 */
function setupActivityCard(card, container, onSaveActivity, onDeleteActivity) {
  const activityId = card.dataset.activityId;

  // Store pending changes on the card element
  card._pendingChanges = new Map();

  // Toggle expand/collapse
  const header = card.querySelector('.activity-card-header');
  header?.addEventListener('click', (e) => {
    // Don't toggle if clicking delete button
    if (e.target.closest('[data-action="delete-activity"]')) return;
    // Handle title click for editing
    if (e.target.closest('.activity-title')) {
      e.stopPropagation();
      const titleSpan = card.querySelector('.activity-title');
      const originalTitle = titleSpan.dataset.value || titleSpan.textContent;
      startTitleEditingWithPending(card, titleSpan, card._pendingChanges, originalTitle);
      return;
    }

    const isExpanded = card.classList.contains('expanded');

    // Collapse all other cards first
    container.querySelectorAll('.activity-card').forEach(otherCard => {
      if (otherCard !== card) {
        collapseActivityCard(otherCard);
      }
    });

    // Toggle current card
    if (isExpanded) {
      collapseActivityCard(card);
    } else {
      expandActivityCard(card);
    }
  });

  // Delete button
  card.querySelector('[data-action="delete-activity"]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(t('itinerary.confirmDeleteActivity'))) {
      if (onDeleteActivity) await onDeleteActivity(activityId);
    }
  });

  // Save button
  card.querySelector('.inline-card-save')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await saveAllActivityChanges(card, card._pendingChanges, activityId, onSaveActivity);
  });

  // Cancel button
  card.querySelector('.inline-card-cancel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelAllActivityChanges(card, card._pendingChanges);
    collapseActivityCard(card);
  });

  // Setup field editing
  card.querySelectorAll('.inline-edit-field:not(.inline-edit-field-location)').forEach(field => {
    setupActivityFieldEditing(field, card);
  });

  // Location field (integrates with card-level save/cancel)
  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField) {
    attachLocationFieldListeners(locationField, activityId, onSaveActivity, card._pendingChanges);
  }
}

/**
 * Setup editing for a single activity field
 */
function setupActivityFieldEditing(field, card) {
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
      const selectedOption = input.querySelector(`option[value="${newValue}"]`);
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
      const selectedOption = input.querySelector(`option[value="${newValue}"]`);
      valueSpan.textContent = selectedOption ? selectedOption.textContent : newValue;
    } else {
      const displayValue = formatDisplayValue(newValue, fieldType);
      const label = field.querySelector('.inline-edit-label')?.textContent.toLowerCase() || 'value';
      valueSpan.textContent = newValue ? displayValue : t('itinerary.addField', { field: label });
      valueSpan.classList.toggle('empty', !newValue);
    }
    valueSpan.dataset.value = newValue;

    if (newValue !== originalValue) {
      card._pendingChanges.set(fieldName, { newValue, originalValue, field, valueSpan, input, fieldType });
    } else {
      card._pendingChanges.delete(fieldName);
    }
  });

  // Escape to close field
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = valueSpan.dataset.value || '';
      input.blur();
    }
  });
}

/**
 * Expand an activity card
 */
function expandActivityCard(card) {
  const details = card.querySelector('.activity-card-details');
  const chevron = card.querySelector('.activity-chevron');
  if (details) details.style.display = 'block';
  if (chevron) chevron.textContent = '▼';
  card.classList.add('expanded');
}

/**
 * Collapse an activity card
 */
function collapseActivityCard(card) {
  const details = card.querySelector('.activity-card-details');
  const chevron = card.querySelector('.activity-chevron');
  if (details) details.style.display = 'none';
  if (chevron) chevron.textContent = '▶';
  card.classList.remove('expanded');
}

/**
 * Save all pending changes for an activity card
 */
async function saveAllActivityChanges(card, pendingChanges, activityId, onSave) {
  if (!onSave || pendingChanges.size === 0) return;

  let hasError = false;

  for (const [fieldName, change] of pendingChanges) {
    try {
      // Pass silent: true to suppress individual toasts
      await onSave(activityId, fieldName, change.newValue, { silent: true });
    } catch (error) {
      console.error(`Failed to save field ${fieldName}:`, error);
      hasError = true;
      // Revert this field on error
      if (change.valueSpan && change.input) {
        if (change.fieldType === 'select') {
          const oldOption = change.input.querySelector(`option[value="${change.originalValue}"]`);
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
}

/**
 * Cancel all pending changes for an activity card
 */
function cancelAllActivityChanges(card, pendingChanges) {
  for (const [fieldName, change] of pendingChanges) {
    if (change.valueSpan && change.input) {
      if (change.fieldType === 'select') {
        const oldOption = change.input.querySelector(`option[value="${change.originalValue}"]`);
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
    const titleSpan = card.querySelector('.activity-title');
    if (titleSpan) {
      titleSpan.textContent = titleChange.originalValue;
      titleSpan.dataset.value = titleChange.originalValue;
    }
  }

  // Revert location field if changed
  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField && locationField._locationData) {
    const data = locationField._locationData;
    const locationChange = pendingChanges.get('location');
    const latChange = pendingChanges.get('latitude');
    const lngChange = pendingChanges.get('longitude');

    if (locationChange || latChange || lngChange) {
      // Revert location input
      if (data.locationInput) {
        data.locationInput.value = data.originalLocation;
      }
      // Revert display value
      if (data.valueSpan) {
        data.valueSpan.textContent = data.originalLocation || t('itinerary.addLocation');
        data.valueSpan.dataset.value = data.originalLocation;
        data.valueSpan.classList.toggle('empty', !data.originalLocation);
      }
      // Revert coordinate inputs
      if (data.latInput) {
        data.latInput.value = data.originalCoords.latitude || '';
      }
      if (data.lngInput) {
        data.lngInput.value = data.originalCoords.longitude || '';
      }
      // Revert selectedCoords
      data.selectedCoords.latitude = data.originalCoords.latitude;
      data.selectedCoords.longitude = data.originalCoords.longitude;
      // Revert coords display
      if (data.coordsSpan) {
        if (data.originalCoords.latitude && data.originalCoords.longitude) {
          data.coordsSpan.textContent = `📍 ${data.originalCoords.latitude.toFixed(6)}, ${data.originalCoords.longitude.toFixed(6)}`;
          data.coordsSpan.style.display = '';
        } else {
          data.coordsSpan.style.display = 'none';
        }
      }
      // Update hint
      if (data.updateLocationHint) {
        data.updateLocationHint();
      }
      // Close editor if open
      if (data.editor) {
        data.editor.style.display = 'none';
      }
      if (data.displaySection) {
        data.displaySection.style.display = 'block';
      }
    }
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

/**
 * Attach listeners for location field with Nominatim search
 * Integrates with card-level pending changes for save/cancel
 */
function attachLocationFieldListeners(field, activityId, onSave, pendingChanges) {
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

  // Store location data on field for revert capability
  field._locationData = {
    originalLocation,
    originalCoords,
    valueSpan,
    locationInput,
    latInput,
    lngInput,
    coordsSpan,
    displaySection,
    editor,
    selectedCoords,
    updateLocationHint: null, // Will be set below
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

  // Sync manual input fields to selectedCoords and track changes
  latInput?.addEventListener('input', () => {
    selectedCoords.latitude = latInput.value ? parseFloat(latInput.value) : null;
    field._locationData.selectedCoords = selectedCoords;
    updateLocationHint();
    trackLocationChange();
  });
  lngInput?.addEventListener('input', () => {
    selectedCoords.longitude = lngInput.value ? parseFloat(lngInput.value) : null;
    field._locationData.selectedCoords = selectedCoords;
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
  field._locationData.updateLocationHint = updateLocationHint;

  // Track location changes in pendingChanges
  function trackLocationChange() {
    const newLocation = locationInput.value.trim();
    const newLat = selectedCoords.latitude;
    const newLng = selectedCoords.longitude;

    const locationChanged = newLocation !== originalLocation;
    const coordsChanged = newLat !== originalCoords.latitude || newLng !== originalCoords.longitude;

    if (locationChanged || coordsChanged) {
      pendingChanges.set('location', { newValue: newLocation, originalValue: originalLocation, fieldType: 'location' });
      pendingChanges.set('latitude', { newValue: newLat, originalValue: originalCoords.latitude });
      pendingChanges.set('longitude', { newValue: newLng, originalValue: originalCoords.longitude });

      // Update display immediately
      valueSpan.textContent = newLocation || t('itinerary.addLocation');
      valueSpan.dataset.value = newLocation;
      valueSpan.classList.toggle('empty', !newLocation);

      // Update coords display
      if (coordsSpan) {
        if (newLat && newLng) {
          coordsSpan.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
          coordsSpan.style.display = '';
        } else {
          coordsSpan.style.display = 'none';
        }
      } else if (newLat && newLng) {
        // Create coords span if it doesn't exist
        const newCoordsSpan = document.createElement('span');
        newCoordsSpan.className = 'inline-location-coords';
        newCoordsSpan.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
        displaySection.appendChild(newCoordsSpan);
      }
    } else {
      pendingChanges.delete('location');
      pendingChanges.delete('latitude');
      pendingChanges.delete('longitude');
    }
  }

  // Location search with debounce
  locationInput?.addEventListener('input', () => {
    const query = locationInput.value.trim();

    // Track change for pending changes
    trackLocationChange();

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
          el.addEventListener('click', () => {
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
    field._locationData.selectedCoords = selectedCoords;

    // Also fill visible inputs in case user opens the section
    if (latInput) latInput.value = result.latitude;
    if (lngInput) lngInput.value = result.longitude;

    updateLocationHint();
    suggestionsContainer.style.display = 'none';

    // Track the change
    trackLocationChange();
  }

  // When clicking outside the editor, close it (but don't save - that happens with card save)
  editor?.addEventListener('focusout', (e) => {
    // Only close if focus is leaving the editor entirely
    setTimeout(() => {
      if (editor && !editor.contains(document.activeElement)) {
        suggestionsContainer.style.display = 'none';
        editor.style.display = 'none';
        displaySection.style.display = 'block';
      }
    }, 100);
  });

  // Close suggestions when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!field.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
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
  if (input.select) input.select();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
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
