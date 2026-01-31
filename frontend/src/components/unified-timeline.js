/**
 * Unified Timeline Component
 * Merges activities, reservations, and suggestions into a single chronological view.
 * - Groups all items by day
 * - Multi-day items (lodging with check-in/check-out) appear on each day they span
 * - Suggestions shown inline with voting/accept/reject controls
 * - Mandatory dates - all new activities default to clicked day's date
 */
import { formatDate, formatTime, formatDateTimeForInput, formatDateTime as formatDateTimePrefs } from '../utils/date-helpers.js';
import { formatDate as formatDateShort, formatTime as formatTimePreference, formatDateTime as formatDateTimePreference } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';
import { getCategoryIcon, getCategoryName, buildCategoryOptions } from '../utils/category-resolver.js';
import { getCategories as getCategoriesState } from '../state/categories-state.js';
import { searchDestinations } from '../services/geocoding-api.js';
import { getPreferences } from '../state/preferences-state.js';
import { hasSpecialFields, isLodgingType as isLodgingTypeUtil } from '../utils/default-categories.js';

// Module-level trip date constraints for activity editing
let tripDateConstraints = { minDate: '', maxDate: '' };

/**
 * Create unified timeline component
 * @param {Array} activities - Array of activity objects (including reservations)
 * @param {Array} suggestions - Array of suggestion objects
 * @param {Object} trip - Trip object
 * @param {Object} options - Options { currentUserId, userRole }
 * @returns {string} HTML string
 */
export function createUnifiedTimeline(activities, suggestions, trip, options = {}) {
  const { currentUserId, userRole = 'viewer' } = options;

  // Store trip date constraints for activity editing
  tripDateConstraints = {
    minDate: trip.startDate ? `${trip.startDate.split('T')[0]}T00:00` : '',
    maxDate: trip.endDate ? `${trip.endDate.split('T')[0]}T23:59` : '',
  };

  // Combine and prepare all items
  const allItems = prepareTimelineItems(activities, suggestions);

  if (allItems.length === 0 && (!trip.startDate || !trip.endDate)) {
    return `
      <div class="unified-timeline empty-state">
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

  // Group items by day (expand multi-day items)
  const itemsByDay = groupItemsByDay(allItems, trip);

  // Build timeline HTML
  const dayGroups = Object.entries(itemsByDay)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dayItems]) => {
      const itemsHtml = dayItems
        .map((item) => createTimelineItem(item, currentUserId, userRole))
        .join('');

      return `
        <div class="timeline-day" data-date="${date}">
          <div class="timeline-day-header">
            <h3 class="timeline-day-title">${formatDate(date, 'full')}</h3>
            <div class="timeline-day-actions">
              <button class="btn btn-sm btn-secondary" data-action="add-activity" data-date="${date}">
                + ${t('trip.addActivity')}
              </button>
              <button class="btn btn-sm btn-ghost" data-action="add-suggestion" data-date="${date}" title="${t('suggestion.suggestActivity')}">
                💡
              </button>
            </div>
          </div>
          <div class="timeline-day-items" data-drop-zone="${date}">
            ${itemsHtml || `<p class="timeline-day-empty">${t('itinerary.noDayActivities', 'No activities for this day')}</p>`}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="unified-timeline">
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
 * Prepare timeline items from activities and suggestions
 * @param {Array} activities - Activity objects
 * @param {Array} suggestions - Suggestion objects
 * @returns {Array} Unified timeline items
 */
function prepareTimelineItems(activities, suggestions) {
  const items = [];

  // Add activities - all are now unified (type determines fields, not isReservation flag)
  activities.forEach((activity) => {
    items.push({
      ...activity,
      itemType: 'activity',
      domain: 'activity',
    });
  });

  // Add pending suggestions only (accepted/rejected are shown in history)
  suggestions
    .filter((s) => s.status === 'pending')
    .forEach((suggestion) => {
      items.push({
        ...suggestion,
        itemType: 'suggestion',
        domain: 'activity',
        type: suggestion.activityType,
      });
    });

  return items;
}

/**
 * Group items by day, expanding multi-day items to appear on each day
 * @param {Array} items - Timeline items
 * @param {Object} trip - Trip object
 * @returns {Object} Items grouped by date (YYYY-MM-DD)
 */
function groupItemsByDay(items, trip) {
  const scheduled = {};

  // Initialize all dates in the trip's date range with empty arrays
  if (trip.startDate && trip.endDate) {
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      scheduled[dateKey] = [];
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Expand multi-day items and place into their days
  items.forEach((item) => {
    const expandedItems = expandMultiDayItem(item);

    expandedItems.forEach((expandedItem) => {
      const dateKey = expandedItem._displayDate;
      if (!dateKey) return; // Skip items without dates

      if (!scheduled[dateKey]) {
        // Activity is outside trip date range, still show it
        scheduled[dateKey] = [];
      }

      scheduled[dateKey].push(expandedItem);
    });
  });

  // Sort items within each day by: orderIndex, then startTime
  Object.keys(scheduled).forEach((dateKey) => {
    scheduled[dateKey].sort((a, b) => {
      // Suggestions go at the bottom
      if (a.itemType === 'suggestion' && b.itemType !== 'suggestion') return 1;
      if (a.itemType !== 'suggestion' && b.itemType === 'suggestion') return -1;

      // Sort by orderIndex first
      const orderA = a.orderIndex ?? 999;
      const orderB = b.orderIndex ?? 999;
      if (orderA !== orderB) return orderA - orderB;

      // Then by startTime
      if (a.startTime && b.startTime) {
        return new Date(a.startTime) - new Date(b.startTime);
      }
      return 0;
    });
  });

  return scheduled;
}

/**
 * Expand a multi-day item into virtual entries for each day it spans
 * @param {Object} item - Timeline item
 * @returns {Array} Array of items (one or more)
 */
function expandMultiDayItem(item) {
  // If no start time, skip (shouldn't happen with mandatory dates)
  if (!item.startTime) {
    return [];
  }

  const startDate = item.startTime.split('T')[0];

  // Check for multi-day items (lodging types with endTime spanning multiple days)
  if (item.endTime && isLodgingTypeUtil(item.type)) {
    const endDate = item.endTime.split('T')[0];

    if (startDate !== endDate) {
      const expanded = [];
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);
      let dayIndex = 0;

      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        expanded.push({
          ...item,
          _displayDate: dateStr,
          _isMultiDay: true,
          _dayIndex: dayIndex,
          _totalDays: Math.ceil((endDateObj - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1,
          _isFirstDay: dayIndex === 0,
          _isLastDay: dateStr === endDate,
        });
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
      }

      return expanded;
    }
  }

  // Single-day item
  return [{
    ...item,
    _displayDate: startDate,
    _isMultiDay: false,
  }];
}

/**
 * Create a timeline item card based on item type
 * Types with special fields (lodging, transport, dining) get special form rendering
 * @param {Object} item - Timeline item
 * @param {string} currentUserId - Current user ID
 * @param {string} userRole - User role
 * @returns {string} HTML string
 */
function createTimelineItem(item, currentUserId, userRole) {
  if (item.itemType === 'suggestion') {
    return createSuggestionTimelineCard(item, currentUserId, userRole);
  }

  // All activities use the same card, but types with special fields get different form rendering
  return createActivityTimelineCard(item);
}

/**
 * Create activity card for timeline
 * Types with special fields (lodging, transport, dining) get type-specific form fields
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
function createActivityTimelineCard(activity) {
  const icon = getCategoryIcon(activity.type, 'activity');
  const typeHasSpecialFields = hasSpecialFields(activity.type);
  const fields = typeHasSpecialFields
    ? getTypeSpecificEditableFields(activity.type, activity)
    : getBasicActivityEditableFields(activity);

  // Multi-day indicator for lodging types
  const multiDayBadge = activity._isMultiDay
    ? `<span class="multi-day-badge" title="${t('timeline.multiDay', 'Multi-day')}">${activity._isFirstDay ? '🏁' : activity._isLastDay ? '🏆' : '📍'} ${t('timeline.day')} ${activity._dayIndex + 1}/${activity._totalDays}</span>`
    : '';

  // Store activity data as JSON for dynamic field updates (exclude internal props)
  const activityDataForStorage = {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    location: activity.location,
    latitude: activity.latitude,
    longitude: activity.longitude,
    startTime: activity.startTime,
    endTime: activity.endTime,
    metadata: activity.metadata || {},
  };

  return `
    <div class="timeline-item activity-card ${activity._isMultiDay ? 'multi-day' : ''}"
         data-activity-id="${activity.id}"
         data-activity-type="${activity.type}"
         data-item-type="activity"
         data-has-special-fields="${typeHasSpecialFields}"
         data-order-index="${activity.orderIndex || 0}"
         data-activity-data="${escapeAttr(JSON.stringify(activityDataForStorage))}">
      <div class="activity-card-content">
        <div class="activity-card-header" data-action="toggle-expand">
          <span class="activity-icon">${icon}</span>
          <span class="activity-title" data-field="title" data-value="${escapeAttr(activity.title)}">${escapeHtml(activity.title)}</span>
          ${multiDayBadge}
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
    </div>
  `;
}

/**
 * Create suggestion card for inline timeline display
 * @param {Object} suggestion - Suggestion object
 * @param {string} currentUserId - Current user ID
 * @param {string} userRole - User role
 * @returns {string} HTML string
 */
function createSuggestionTimelineCard(suggestion, currentUserId, userRole) {
  const canResolve = userRole === 'owner' || userRole === 'editor';
  const isOwn = suggestion.suggestedByUserId === currentUserId;

  // Calculate user's vote
  const userVote = suggestion.votes?.find((v) => v.userId === currentUserId);
  const hasUpvoted = userVote?.vote === 'up';
  const hasDownvoted = userVote?.vote === 'down';

  const icon = getCategoryIcon(suggestion.type || suggestion.activityType, 'activity');
  const suggestedByName = isOwn
    ? t('expenses.you')
    : escapeHtml(suggestion.suggestedByName || t('common.unknown'));

  // Time display if set
  const timeDisplay = suggestion.startTime
    ? `<span class="suggestion-time-display">${formatTimePreference(new Date(suggestion.startTime))}</span>`
    : '';

  return `
    <div class="timeline-item timeline-item--suggestion suggestion-card"
         data-suggestion-id="${suggestion.id}"
         data-item-type="suggestion">
      <div class="suggestion-card-header">
        <span class="suggestion-badge">${t('suggestion.pending', '💡 Suggested')}</span>
        <span class="suggestion-icon">${icon}</span>
        <span class="suggestion-title">${escapeHtml(suggestion.title)}</span>
        ${timeDisplay}
        <span class="suggestion-header-spacer"></span>
      </div>

      <div class="suggestion-card-body">
        ${suggestion.description ? `<p class="suggestion-description">${escapeHtml(suggestion.description)}</p>` : ''}
        ${suggestion.location ? `<div class="suggestion-location"><span class="icon">📍</span> ${escapeHtml(suggestion.location)}</div>` : ''}
        <div class="suggestion-meta">
          <span class="suggestion-author">${t('suggestion.suggestedBy', { name: suggestedByName })}</span>
        </div>
      </div>

      <div class="suggestion-card-footer">
        <div class="suggestion-voting">
          <button
            class="btn btn-sm btn-vote ${hasUpvoted ? 'active' : ''}"
            data-action="vote-suggestion"
            data-suggestion-id="${suggestion.id}"
            data-vote="up"
            title="${t('suggestion.upvote')}">
            👍 <span class="vote-count">${suggestion.upvotes || 0}</span>
          </button>
          <button
            class="btn btn-sm btn-vote ${hasDownvoted ? 'active' : ''}"
            data-action="vote-suggestion"
            data-suggestion-id="${suggestion.id}"
            data-vote="down"
            title="${t('suggestion.downvote')}">
            👎 <span class="vote-count">${suggestion.downvotes || 0}</span>
          </button>
        </div>

        ${canResolve ? `
          <div class="suggestion-resolve-actions">
            <button
              class="btn btn-sm btn-success"
              data-action="accept-suggestion"
              data-suggestion-id="${suggestion.id}"
              title="${t('suggestion.acceptAndAdd')}">
              ✓ ${t('invitations.accept')}
            </button>
            <button
              class="btn btn-sm btn-danger"
              data-action="reject-suggestion"
              data-suggestion-id="${suggestion.id}"
              title="${t('suggestion.rejectSuggestion')}">
              ✕ ${t('invitations.decline')}
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Get basic editable fields HTML for an activity (types without special fields)
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
function getBasicActivityEditableFields(activity) {
  const { type, location, startTime, endTime, description, latitude, longitude } = activity;
  const fields = [];

  // Activity Type (dropdown)
  fields.push(createActivityTypeField(type));

  // Start Time - constrained to trip date range
  fields.push(createEditableField('startTime', t('activity.startTime'), formatDateTimeForInput(startTime) || '', 'datetime-local', {
    min: tripDateConstraints.minDate,
    max: tripDateConstraints.maxDate,
  }));

  // End Time - constrained to trip date range
  fields.push(createEditableField('endTime', t('activity.endTime'), formatDateTimeForInput(endTime) || '', 'datetime-local', {
    min: tripDateConstraints.minDate,
    max: tripDateConstraints.maxDate,
  }));

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
 * Get type-specific editable fields HTML for activities with special fields
 * (lodging, transport, dining types)
 * @param {string} type - Activity type
 * @param {Object} activity - Activity object
 * @returns {string} HTML string
 */
function getTypeSpecificEditableFields(type, activity) {
  const { metadata = {}, location, startTime, endTime, description, latitude, longitude } = activity;
  const fields = [];

  // Date constraints from trip
  const dateOpts = { min: tripDateConstraints.minDate.split('T')[0], max: tripDateConstraints.maxDate.split('T')[0] };

  // Activity Type dropdown (showing types with special fields)
  fields.push(createSpecialFieldsTypeDropdown(type));

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

    case 'hostel':
      fields.push(createEditableField('propertyName', t('reservations.fields.hostelName'), metadata.propertyName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('checkInDate', t('reservations.fields.checkInDate'), metadata.checkInDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('checkOutDate', t('reservations.fields.checkOutDate'), metadata.checkOutDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    case 'camping':
      fields.push(createEditableField('propertyName', t('reservations.fields.campgroundName'), metadata.propertyName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('checkInDate', t('reservations.fields.checkInDate'), metadata.checkInDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('checkOutDate', t('reservations.fields.checkOutDate'), metadata.checkOutDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    case 'resort':
      fields.push(createEditableField('propertyName', t('reservations.fields.resortName'), metadata.propertyName || '', 'text'));
      fields.push(createEditableField('provider', t('reservations.fields.bookingProvider'), metadata.provider || '', 'text'));
      fields.push(createEditableField('checkInDate', t('reservations.fields.checkInDate'), metadata.checkInDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('checkOutDate', t('reservations.fields.checkOutDate'), metadata.checkOutDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('reservations.fields.locationAddress'), location, latitude, longitude));
      break;

    // ===== TRANSPORT TYPES =====
    case 'bus':
      fields.push(createEditableField('provider', t('reservations.fields.busCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('busNumber', t('reservations.fields.busNumber'), metadata.busNumber || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.departureStation'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.arrivalStation'), metadata.destination || '', 'text'));
      fields.push(createEditableField('departureDate', t('reservations.fields.departureDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('departureTime', t('reservations.fields.departureTime'), metadata.departureTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'car':
      fields.push(createEditableField('provider', t('reservations.fields.rentalCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('vehicleType', t('reservations.fields.vehicleType'), metadata.vehicleType || '', 'text'));
      fields.push(createEditableField('pickupLocation', t('reservations.fields.pickupLocation'), metadata.pickupLocation || '', 'text'));
      fields.push(createEditableField('pickupDate', t('reservations.fields.pickupDate'), metadata.pickupDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('dropoffDate', t('reservations.fields.returnDate'), metadata.dropoffDate || extractDate(endTime), 'date', dateOpts));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'cruise':
      fields.push(createEditableField('provider', t('reservations.fields.cruiseLine'), metadata.provider || '', 'text'));
      fields.push(createEditableField('shipName', t('reservations.fields.shipName'), metadata.shipName || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.departurePort'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.arrivalPort'), metadata.destination || '', 'text'));
      fields.push(createEditableField('departureDate', t('reservations.fields.departureDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('departureTime', t('reservations.fields.departureTime'), metadata.departureTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('cabinType', t('reservations.fields.cabinType'), metadata.cabinType || '', 'text'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'ferry':
      fields.push(createEditableField('provider', t('reservations.fields.ferryCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.departurePort'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.arrivalPort'), metadata.destination || '', 'text'));
      fields.push(createEditableField('departureDate', t('reservations.fields.departureDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('departureTime', t('reservations.fields.departureTime'), metadata.departureTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'flight':
      fields.push(createEditableField('provider', t('reservations.fields.airline'), metadata.provider || '', 'text'));
      fields.push(createEditableField('flightNumber', t('reservations.fields.flightNumber'), metadata.flightNumbers?.[0] || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.origin'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.destination'), metadata.destination || '', 'text'));
      fields.push(createEditableField('departureDate', t('reservations.fields.departureDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('departureTime', t('reservations.fields.departureTime'), metadata.departureTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'train':
      fields.push(createEditableField('provider', t('reservations.fields.railCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('trainNumber', t('reservations.fields.trainNumber'), metadata.trainNumber || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.departureStation'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.arrivalStation'), metadata.destination || '', 'text'));
      fields.push(createEditableField('departureDate', t('reservations.fields.departureDate'), extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('departureTime', t('reservations.fields.departureTime'), metadata.departureTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('seatClass', t('reservations.fields.class'), metadata.seatClass || '', 'text'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'taxi':
      fields.push(createEditableField('provider', t('reservations.fields.taxiCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.pickupLocation'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.dropoffLocation'), metadata.destination || '', 'text'));
      fields.push(createEditableField('pickupDate', t('reservations.fields.pickupDate'), metadata.pickupDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('pickupTime', t('reservations.fields.pickupTime'), metadata.pickupTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
      break;

    case 'transfer':
      fields.push(createEditableField('provider', t('reservations.fields.transferCompany'), metadata.provider || '', 'text'));
      fields.push(createEditableField('origin', t('reservations.fields.pickupLocation'), metadata.origin || '', 'text'));
      fields.push(createEditableField('destination', t('reservations.fields.dropoffLocation'), metadata.destination || '', 'text'));
      fields.push(createEditableField('pickupDate', t('reservations.fields.pickupDate'), metadata.pickupDate || extractDate(startTime), 'date', dateOpts));
      fields.push(createEditableField('pickupTime', t('reservations.fields.pickupTime'), metadata.pickupTime || extractTime(startTime), 'time'));
      fields.push(createEditableField('confirmationCode', t('reservations.fields.confirmationCode'), metadata.confirmationCode || '', 'text'));
      fields.push(createLocationField(t('activity.location'), location, latitude, longitude));
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

    case 'cafe':
      fields.push(createEditableField('venueName', t('reservations.fields.cafeName'), metadata.venueName || '', 'text'));
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

  return `<div class="activity-type-specific-fields">${fields.join('')}${actionButtons}</div>`;
}

/**
 * Create activity type dropdown field
 * @param {string} currentType - Current activity type value
 * @returns {string} HTML string
 */
function createActivityTypeField(currentType) {
  const categories = getCategoriesState();
  const defaults = categories?.defaults?.activity || [];
  const custom = categories?.custom?.activity || [];
  const categoryOptions = buildCategoryOptions('activity', defaults, custom);

  const currentIcon = getCategoryIcon(currentType, 'activity');
  const currentName = getCategoryName(currentType, 'activity');
  const currentLabel = `${currentIcon} ${currentName}`;

  let optionsHtml = '';
  categoryOptions.forEach((item) => {
    if (item.groupLabel) {
      optionsHtml += `<optgroup label="${item.groupLabel}">`;
      item.options.forEach((opt) => {
        optionsHtml += `<option value="${opt.value}" ${opt.value === currentType ? 'selected' : ''}>${opt.icon} ${opt.label}</option>`;
      });
      optionsHtml += '</optgroup>';
    } else {
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
 * Create type dropdown for activities with special fields
 * Shows ALL activity types (unified system - any type can be selected)
 * @param {string} currentType - Current activity type value
 * @returns {string} HTML string
 */
function createSpecialFieldsTypeDropdown(currentType) {
  // Use the same logic as createActivityTypeField - show ALL types
  // This allows users to change a flight to a museum, hotel to a park, etc.
  return createActivityTypeField(currentType);
}

/**
 * Create a single editable field
 * @param {string} fieldName - Field name for data attribute
 * @param {string} label - Display label
 * @param {string} value - Current value
 * @param {string} inputType - Input type
 * @param {Object} options - Optional constraints { min, max }
 * @returns {string} HTML string
 */
function createEditableField(fieldName, label, value, inputType, options = {}) {
  const displayValue = formatDisplayValue(value, inputType);
  const isEmpty = !value && value !== 0;
  const addPlaceholder = t('itinerary.addField', { field: label.toLowerCase() });

  let constraintAttrs = '';
  if (inputType === 'number') {
    constraintAttrs = `min="${options.min || 1}" max="${options.max || 100}"`;
  } else if (inputType === 'date' || inputType === 'datetime-local') {
    const minAttr = options.min ? `min="${options.min}"` : '';
    const maxAttr = options.max ? `max="${options.max}"` : '';
    constraintAttrs = `${minAttr} ${maxAttr}`.trim();
  }

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
 * Format value for display based on type
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
 * Escape HTML to prevent XSS
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

// Store document click handler for cleanup
let currentTimelineDocClickHandler = null;

/**
 * Attach unified timeline listeners
 * @param {HTMLElement} container - Timeline container
 * @param {Object} callbacks - Event callbacks
 */
export function attachUnifiedTimelineListeners(container, callbacks) {
  const {
    onAddActivity,
    onAddSuggestion,
    onEditActivity,
    onDeleteActivity,
    onSaveActivity,
    onActivityTypeChange,
    onVoteSuggestion,
    onAcceptSuggestion,
    onRejectSuggestion,
    // Legacy callback aliases for backwards compatibility
    onDeleteReservation,
    onSaveReservation,
    onReservationTypeChange,
  } = callbacks;

  // Add activity buttons
  container.querySelectorAll('[data-action="add-activity"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const date = btn.getAttribute('data-date');
      if (onAddActivity) onAddActivity(date);
    });
  });

  // Add suggestion buttons
  container.querySelectorAll('[data-action="add-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const date = btn.getAttribute('data-date');
      if (onAddSuggestion) onAddSuggestion(date);
    });
  });

  // Handle all activity cards (unified - no separate reservation cards)
  // Use combined callbacks, preferring new names but falling back to legacy names
  const saveCallback = onSaveActivity || onSaveReservation;
  const deleteCallback = onDeleteActivity || onDeleteReservation;
  const typeChangeCallback = onActivityTypeChange || onReservationTypeChange;

  container.querySelectorAll('.activity-card[data-item-type="activity"]').forEach((card) => {
    setupActivityCard(card, container, saveCallback, deleteCallback, typeChangeCallback);
  });

  // Handle suggestion cards
  container.querySelectorAll('.suggestion-card[data-item-type="suggestion"]').forEach((card) => {
    setupSuggestionCard(card, onVoteSuggestion, onAcceptSuggestion, onRejectSuggestion);
  });

  // Remove previous document click handler if exists
  if (currentTimelineDocClickHandler) {
    document.removeEventListener('click', currentTimelineDocClickHandler);
  }

  // Click outside any expanded card to save and collapse
  currentTimelineDocClickHandler = (e) => {
    // Handle all activity cards (unified)
    const expandedActivityCards = container.querySelectorAll('.activity-card.expanded');
    expandedActivityCards.forEach((card) => {
      if (!card.contains(e.target)) {
        const activityId = card.dataset.activityId;
        const activityType = card.dataset.activityType;
        const pendingChanges = card._pendingChanges;
        if (pendingChanges && pendingChanges.size > 0) {
          saveAllActivityChanges(card, pendingChanges, activityId, activityType, saveCallback, typeChangeCallback);
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
function setupActivityCard(card, container, onSaveActivity, onDeleteActivity, onActivityTypeChange) {
  const activityId = card.dataset.activityId;
  const activityType = card.dataset.activityType;
  card._pendingChanges = new Map();

  // Store callbacks on the card for use after dynamic field updates
  card._saveCallback = onSaveActivity;
  card._typeChangeCallback = onActivityTypeChange;

  // Toggle expand/collapse
  const header = card.querySelector('.activity-card-header');
  header?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="delete-activity"]')) return;

    if (e.target.closest('.activity-title')) {
      e.stopPropagation();
      const titleSpan = card.querySelector('.activity-title');
      const originalTitle = titleSpan.dataset.value || titleSpan.textContent;
      startTitleEditing(card, titleSpan, card._pendingChanges, originalTitle);
      return;
    }

    const isExpanded = card.classList.contains('expanded');
    container.querySelectorAll('.activity-card').forEach((otherCard) => {
      if (otherCard !== card) {
        collapseActivityCard(otherCard);
      }
    });

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
    await saveAllActivityChanges(card, card._pendingChanges, activityId, activityType, onSaveActivity, onActivityTypeChange);
  });

  // Cancel button
  card.querySelector('.inline-card-cancel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelAllChanges(card, card._pendingChanges);
    collapseActivityCard(card);
  });

  // Setup field editing
  card.querySelectorAll('.inline-edit-field:not(.inline-edit-field-location)').forEach((field) => {
    setupFieldEditing(field, card);
  });

  // Location field
  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField) {
    attachLocationFieldListeners(locationField, card._pendingChanges);
  }
}

/**
 * Setup a suggestion card with voting and resolve handlers
 */
function setupSuggestionCard(card, onVoteSuggestion, onAcceptSuggestion, onRejectSuggestion) {
  const suggestionId = card.dataset.suggestionId;

  // Vote buttons
  card.querySelectorAll('[data-action="vote-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vote = btn.dataset.vote;
      if (onVoteSuggestion) onVoteSuggestion(suggestionId, vote);
    });
  });

  // Accept button
  card.querySelector('[data-action="accept-suggestion"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onAcceptSuggestion) onAcceptSuggestion(suggestionId);
  });

  // Reject button
  card.querySelector('[data-action="reject-suggestion"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onRejectSuggestion) onRejectSuggestion(suggestionId);
  });
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

  valueSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    startEditing(field, valueSpan, input);
  });

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

      // If this is the type field, dynamically update the form fields
      if (fieldName === 'type') {
        updateCardFieldsForType(card, newValue);
      }
    });
  }

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

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = valueSpan.dataset.value || '';
      input.blur();
    }
  });
}

/**
 * Update card fields dynamically when type changes
 * @param {HTMLElement} card - The activity card element
 * @param {string} newType - The new activity type
 */
function updateCardFieldsForType(card, newType) {
  // Get stored activity data
  const activityDataStr = card.dataset.activityData;
  if (!activityDataStr) return;

  let activityData;
  try {
    activityData = JSON.parse(activityDataStr);
  } catch {
    return;
  }

  // Update the activity data with new type
  activityData.type = newType;

  // Update card's data attributes
  card.dataset.activityType = newType;
  card.dataset.hasSpecialFields = hasSpecialFields(newType);

  // Update the stored activity data
  card.dataset.activityData = JSON.stringify(activityData);

  // Update the icon in the header
  const iconSpan = card.querySelector('.activity-icon');
  if (iconSpan) {
    iconSpan.textContent = getCategoryIcon(newType, 'activity');
  }

  // Generate new fields based on the new type
  const typeHasSpecialFields = hasSpecialFields(newType);
  const newFieldsHtml = typeHasSpecialFields
    ? getTypeSpecificEditableFields(newType, activityData)
    : getBasicActivityEditableFields(activityData);

  // Find the fields container and replace its contents
  const fieldsContainer = card.querySelector('.activity-fields');
  if (fieldsContainer) {
    fieldsContainer.innerHTML = newFieldsHtml;

    // Re-attach event listeners to the new fields
    fieldsContainer.querySelectorAll('.inline-edit-field:not(.inline-edit-field-location)').forEach((field) => {
      setupFieldEditing(field, card);
    });

    // Re-attach location field listeners
    const locationField = fieldsContainer.querySelector('.inline-edit-field-location');
    if (locationField) {
      attachLocationFieldListeners(locationField, card._pendingChanges);
    }

    // Re-attach save/cancel button listeners
    const saveBtn = fieldsContainer.querySelector('.inline-card-save');
    const cancelBtn = fieldsContainer.querySelector('.inline-card-cancel');

    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const activityId = card.dataset.activityId;
        const activityType = card.dataset.activityType;
        // Get callbacks from card (stored during setup)
        if (card._saveCallback) {
          await saveAllActivityChanges(card, card._pendingChanges, activityId, activityType, card._saveCallback, card._typeChangeCallback);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelAllChanges(card, card._pendingChanges);
        collapseActivityCard(card);
      });
    }
  }
}

/**
 * Start editing a field
 */
function startEditing(field, valueSpan, input) {
  field.classList.add('editing');
  valueSpan.style.display = 'none';
  input.style.display = 'block';
  input.focus();
  if (typeof input.select === 'function' && input.tagName !== 'SELECT') {
    input.select();
  }
}

/**
 * Start title editing with pending changes tracking
 */
function startTitleEditing(card, titleSpan, pendingChanges, originalTitle) {
  const currentValue = titleSpan.dataset.value || titleSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-title-input';
  input.value = currentValue;

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
 * Expand an activity card
 */
function expandActivityCard(card) {
  if (!card.classList.contains('activity-card')) return;
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
  if (!card.classList.contains('activity-card')) return;
  const details = card.querySelector('.activity-card-details');
  const chevron = card.querySelector('.activity-chevron');
  if (details) details.style.display = 'none';
  if (chevron) chevron.textContent = '▶';
  card.classList.remove('expanded');
}

/**
 * Save all pending changes for an activity card
 */
async function saveAllActivityChanges(card, pendingChanges, activityId, activityType, onSave, onTypeChange) {
  if (!onSave || pendingChanges.size === 0) return;

  let typeChanged = false;
  let newType = null;
  let hasError = false;

  for (const [fieldName, change] of pendingChanges) {
    try {
      await onSave(activityId, fieldName, change.newValue, { silent: true });
      if (fieldName === 'type') {
        typeChanged = true;
        newType = change.newValue;
      }
    } catch (error) {
      console.error(`Failed to save field ${fieldName}:`, error);
      hasError = true;
      revertChange(change);
    }
  }

  pendingChanges.clear();

  if (hasError) {
    showToast(t('itinerary.someChangesFailed'), 'error');
  } else {
    showToast(t('activity.saved'), 'success');
  }

  // Trigger type change callback if type was changed (to refresh the form fields)
  if (typeChanged && onTypeChange) {
    onTypeChange(activityId, newType);
  }
}

/**
 * Revert a single change
 */
function revertChange(change) {
  if (change.valueSpan && change.input) {
    if (change.fieldType === 'select') {
      const oldOption = Array.from(change.input.options).find((opt) => opt.value === change.originalValue);
      change.valueSpan.textContent = oldOption ? oldOption.textContent : change.originalValue;
    } else {
      const displayValue = formatDisplayValue(change.originalValue, change.fieldType);
      change.valueSpan.textContent = change.originalValue ? displayValue : t('itinerary.addValue');
    }
    change.valueSpan.dataset.value = change.originalValue;
    change.input.value = change.originalValue;
  }
}

/**
 * Cancel all pending changes for a card
 */
function cancelAllChanges(card, pendingChanges) {
  for (const [fieldName, change] of pendingChanges) {
    if (['location', 'latitude', 'longitude'].includes(fieldName)) continue;
    revertChange(change);
  }

  const titleChange = pendingChanges.get('title');
  if (titleChange) {
    const titleSpan = card.querySelector('.activity-title');
    if (titleSpan) {
      titleSpan.textContent = titleChange.originalValue;
      titleSpan.dataset.value = titleChange.originalValue;
    }
  }

  const locationField = card.querySelector('.inline-edit-field-location');
  if (locationField?._locationData) {
    locationField._locationData.revertToOriginal();
  }

  pendingChanges.clear();
}

/**
 * Attach listeners for location field with Nominatim search
 */
function attachLocationFieldListeners(field, pendingChanges) {
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

  field._locationData = {
    originalLocation,
    originalCoords,
    getCurrentValues: () => ({
      location: locationInput?.value.trim() || '',
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
    }),
    revertToOriginal: () => {
      if (locationInput) locationInput.value = originalLocation;
      selectedCoords = { ...originalCoords };
      if (latInput) latInput.value = originalCoords.latitude || '';
      if (lngInput) lngInput.value = originalCoords.longitude || '';
      updateLocationHint();
      if (valueSpan) {
        valueSpan.textContent = originalLocation || t('itinerary.addLocation');
        valueSpan.dataset.value = originalLocation;
        valueSpan.classList.toggle('empty', !originalLocation);
      }
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

  valueSpan?.addEventListener('click', (e) => {
    e.stopPropagation();
    displaySection.style.display = 'none';
    editor.style.display = 'block';
    locationInput?.focus();
  });

  manualCoordsToggle?.addEventListener('change', () => {
    manualCoordsSection.style.display = manualCoordsToggle.checked ? 'block' : 'none';
    if (manualCoordsToggle.checked) {
      if (selectedCoords.latitude) latInput.value = selectedCoords.latitude;
      if (selectedCoords.longitude) lngInput.value = selectedCoords.longitude;
    }
  });

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

  function trackLocationChange() {
    const newLocation = locationInput?.value.trim() || '';
    const newLat = selectedCoords.latitude;
    const newLng = selectedCoords.longitude;

    const locationChanged = newLocation !== originalLocation;
    const coordsChanged = newLat !== originalCoords.latitude || newLng !== originalCoords.longitude;

    if (locationChanged || coordsChanged) {
      pendingChanges.set('location', { newValue: newLocation, originalValue: originalLocation, fieldType: 'location' });
      if (coordsChanged) {
        pendingChanges.set('latitude', { newValue: newLat, originalValue: originalCoords.latitude, fieldType: 'number' });
        pendingChanges.set('longitude', { newValue: newLng, originalValue: originalCoords.longitude, fieldType: 'number' });
      }

      if (valueSpan) {
        valueSpan.textContent = newLocation || t('itinerary.addLocation');
        valueSpan.dataset.value = newLocation;
        valueSpan.classList.toggle('empty', !newLocation);
      }

      if (coordsSpan) {
        if (newLat && newLng) {
          coordsSpan.textContent = `📍 ${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
          coordsSpan.style.display = '';
        } else {
          coordsSpan.style.display = 'none';
        }
      }
    } else {
      pendingChanges.delete('location');
      pendingChanges.delete('latitude');
      pendingChanges.delete('longitude');
    }
  }

  locationInput?.addEventListener('input', () => {
    const query = locationInput.value.trim();

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      suggestionsContainer.innerHTML = '';
      trackLocationChange();
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      searchIndicator.style.display = 'flex';

      try {
        const { language } = getPreferences();
        const result = await searchDestinations(query, { limit: 5, language });
        const results = result.results.map((item) => ({
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }));

        searchIndicator.style.display = 'none';

        if (results.length > 0) {
          suggestionsContainer.innerHTML = results.map((r, index) => `
            <div class="inline-location-suggestion" data-index="${index}">
              <div class="inline-location-suggestion-name">${escapeHtml(truncateText(r.displayName, 80))}</div>
              <div class="inline-location-suggestion-coords">📍 ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</div>
            </div>
          `).join('');
          suggestionsContainer.style.display = 'block';

          suggestionsContainer.querySelectorAll('.inline-location-suggestion').forEach((el, index) => {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              const r = results[index];
              locationInput.value = r.displayName.split(',')[0];
              selectedCoords.latitude = r.latitude;
              selectedCoords.longitude = r.longitude;
              if (latInput) latInput.value = r.latitude;
              if (lngInput) lngInput.value = r.longitude;
              updateLocationHint();
              suggestionsContainer.style.display = 'none';
              trackLocationChange();
            });
          });
        } else {
          suggestionsContainer.innerHTML = `<div class="inline-location-suggestion-empty">${t('itinerary.noLocationsFound')}</div>`;
          suggestionsContainer.style.display = 'block';
        }
      } catch (error) {
        searchIndicator.style.display = 'none';
        console.error('Location search error:', error);
      }

      trackLocationChange();
    }, 500);
  });

  editor?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!field.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
      if (editor?.style.display !== 'none') {
        editor.style.display = 'none';
        displaySection.style.display = 'block';
      }
    }
  });
}

export default {
  createUnifiedTimeline,
  attachUnifiedTimelineListeners,
};
