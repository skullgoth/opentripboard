// T077: TripDetail page - display itinerary timeline and manage activities
// T187-T189: Map view integration with activities
// US4: Reservation sections (Hotels & Lodging, Transportation)
// US9: Export and sharing functionality
import { createItineraryTimeline, attachTimelineListeners } from '../components/itinerary-timeline.js';
import { createTripForm, attachTripFormListeners } from '../components/trip-form.js';
import { initializeDragDrop, destroyDragDrop, addDragDropStyles } from '../components/drag-drop.js';
import { createPresenceIndicator } from '../components/presence-indicator.js';
import { createMapView, initializeMap, generateGoogleMapsUrl } from '../components/map-view.js';
import { showToast } from '../utils/toast.js';
import { createSuggestionList, createSuggestionForm, attachSuggestionFormListeners, renderPaginatedHistory } from '../components/suggestion-list.js';
import { createTripBuddyList, createCompactTripBuddyList } from '../components/trip-buddy-list.js';
import { createInviteTripBuddyModal, validateInviteTripBuddyForm, displayFormErrors } from '../components/invite-trip-buddy-form.js';
import { createLodgingSection, createTransportationSection, createDiningEventsSection, attachReservationSectionListeners, setTripDateConstraints } from '../components/trip-reservations.js';
import { showShareDialog } from '../components/share-dialog.js';
import { showExportModal } from '../components/export-modal.js';
import { generateGoogleMapsUrl as generateRouteMapsUrl, openInGoogleMaps } from '../utils/google-maps.js';
import { wsClient } from '../services/websocket-client.js';
import { realtimeManager } from '../services/realtime-updates.js';
import { app } from '../main.js';
import { tripState } from '../state/trip-state.js';
import { suggestionState } from '../state/suggestion-state.js';
import { tripBuddyState } from '../state/trip-buddy-state.js';
import { authState } from '../state/auth-state.js';
import { getItem } from '../utils/storage.js';
import apiClient from '../services/api-client.js';
import { formatDate } from '../utils/date-helpers.js';
import { t } from '../utils/i18n.js';

let sortableInstances = [];
let currentTrip = null;
let currentActivities = [];
let currentSuggestions = [];
let currentTripBuddies = [];
let activeUsers = [];
let presenceUnsubscribe = null;
let suggestionUnsubscribe = null;
let tripBuddyUnsubscribe = null;
let activityUnsubscribe = null; // T152: Track activity update subscription
let historyVisible = false;
let historyCurrentPage = 1;
const HISTORY_PER_PAGE = 5;
let mapInstance = null; // T187: Track map instance for cleanup and updates

/**
 * Render trip detail page
 * @param {Object} params - Route parameters
 */
export async function tripDetailPage(params) {
  const container = document.getElementById('page-container');
  const { id: tripId } = params;

  // Check authentication (T084: Loading states and error handling)
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  // Show loading state (T084)
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>${t('trip.loading')}</p>
    </div>
  `;

  try {
    // T082: Wire activity creation flow - Load trip, activities, suggestions, and tripBuddies from API
    const [trip, activities, suggestions, tripBuddies] = await Promise.all([
      tripState.loadTrip(tripId),
      tripState.loadActivities(tripId),
      suggestionState.loadSuggestions(tripId),
      tripBuddyState.loadTripBuddies(tripId),
    ]);

    currentTrip = trip;
    currentActivities = activities;
    currentSuggestions = suggestions;
    currentTripBuddies = tripBuddies;

    // Get cover image URL
    const coverImageUrl = getCoverImageUrl(trip);

    // Check if current user is the owner
    const currentUser = authState.getCurrentUser();
    const isOwner = trip.ownerId === currentUser?.id;

    // Render trip buddy list (full list for sidebar)
    const tripBuddyListHtml = createTripBuddyList(
      tripBuddies,
      trip.ownerId,
      currentUser?.id,
      isOwner,
      activeUsers
    );

    // Render compact buddy list for overlay
    const tripBuddyCompactHtml = createCompactTripBuddyList(
      tripBuddies,
      currentUser?.id,
      isOwner,
      activeUsers
    );

    // Render page header
    // Format dates for display using preference-aware formatter (medium format like My Trips page)
    const dateRange = trip.startDate && trip.endDate
      ? `${formatDate(trip.startDate, 'medium')} - ${formatDate(trip.endDate, 'medium')}`
      : '';

    const headerHtml = `
      <div class="trip-detail-header">
        <div class="trip-cover-image-header">
          <img
            src="${coverImageUrl}"
            alt="Cover image for ${escapeHtml(trip.name)}"
            class="trip-cover-image"
            data-testid="trip-cover-image"
          />
          ${renderCoverImageAttribution(trip)}
          <div class="cover-image-actions">
            <button class="btn btn-icon" data-action="edit-cover-image" title="${isOwner ? t('trip.changeCover') : t('trip.ownerOnly', { action: t('trip.changeCover').toLowerCase() })}" ${!isOwner ? 'disabled' : ''}>
              <span>📷</span>
            </button>
            ${trip.coverImageUrl ? `
              <button class="btn btn-icon delete-cover-button" data-action="delete-cover-image" title="${isOwner ? t('trip.removeCover') : t('trip.ownerOnly', { action: t('trip.removeCover').toLowerCase() })}" ${!isOwner ? 'disabled' : ''}>
                <span>🗑️</span>
              </button>
            ` : ''}
          </div>
          <div class="trip-actions-menu">
            <button class="btn btn-icon trip-menu-trigger" data-action="toggle-trip-menu" title="${t('trip.tripOptions')}" data-testid="trip-menu-button">
              <span>⋮</span>
            </button>
            <div class="dropdown-menu trip-menu-dropdown" style="display: none;">
              <button class="dropdown-item" data-action="export-trip" title="${t('export.export')}">
                <span class="dropdown-item-icon">📥</span>
                <span>${t('export.export')}</span>
              </button>
              <button class="dropdown-item" data-action="export-google-maps" title="${t('trip.openGoogleMaps')}">
                <span class="dropdown-item-icon">🗺️</span>
                <span>${t('trip.openGoogleMaps')}</span>
              </button>
              <button class="dropdown-item" data-action="share-trip" title="${t('trip.shareTrip')}" aria-label="${t('trip.shareTrip')}">
                <span class="dropdown-item-icon">🔗</span>
                <span>${t('trip.shareTrip')}</span>
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" data-action="edit-trip" ${!isOwner ? 'disabled' : ''} title="${!isOwner ? t('trip.ownerOnly', { action: t('trip.editTrip').toLowerCase() }) : t('trip.editTrip')}" data-testid="edit-trip-menu-item">
                <span class="dropdown-item-icon">✏️</span>
                <span>${t('trip.editTrip')}</span>
              </button>
              <button class="dropdown-item dropdown-item-danger" data-action="delete-trip" ${!isOwner ? 'disabled' : ''} title="${!isOwner ? t('trip.ownerOnly', { action: t('trip.deleteTrip').toLowerCase() }) : t('trip.deleteTrip')}" data-testid="delete-trip-menu-item">
                <span class="dropdown-item-icon">🗑️</span>
                <span>${t('trip.deleteTrip')}</span>
              </button>
            </div>
          </div>
          <div class="trip-info-overlay">
            <h1>${escapeHtml(trip.name)}</h1>
            ${dateRange ? `<div class="trip-dates"><span class="date-range">${dateRange}</span></div>` : ''}
            <div class="trip-buddies-inline">
              ${tripBuddyCompactHtml}
            </div>
          </div>
          <input
            type="file"
            id="cover-image-input"
            accept="image/jpeg,image/png,image/webp"
            style="display: none;"
          />
        </div>
      </div>
    `;

    // US4: Render reservation sections (Hotels, Transportation, Dining & Events)
    // Set trip date constraints for reservation forms
    setTripDateConstraints(trip);
    const lodgingSectionHtml = createLodgingSection(activities);
    const transportSectionHtml = createTransportationSection(activities);
    const diningEventsSectionHtml = createDiningEventsSection(activities);

    // Render timeline (filter out reservation activities to avoid duplicates)
    const nonReservationActivities = activities.filter(a => !a.metadata?.isReservation);
    const timelineHtml = createItineraryTimeline(nonReservationActivities, trip);

    // Render suggestion list
    const suggestionListHtml = createSuggestionList(
      suggestions,
      currentUser?.id,
      'editor', // TODO: Get actual user role from collaboration state
      () => handleAddSuggestion()
    );

    // T187: Render map view HTML
    const hasActivitiesWithCoords = currentActivities.some(
      a => a.latitude && a.longitude
    );
    const mapViewHtml = await createMapView(currentActivities, {
      containerId: 'trip-map',
      showControls: true
    });

    container.innerHTML = `
      <div class="trip-detail-page">
        <div class="trip-detail-content">
          <div class="trip-content-section">
            ${headerHtml}
            <div class="trip-quick-links">
              <a class="trip-quick-link" href="#/trips/${trip.id}/documents" data-testid="documents-quick-link">
                <span class="trip-quick-link-icon">📄</span>
                <span>${t('trip.documents')}</span>
              </a>
              <a class="trip-quick-link" href="#/trips/${trip.id}/budget" data-testid="budget-quick-link">
                <span class="trip-quick-link-icon">💰</span>
                <span>${t('trip.budget')}</span>
              </a>
              <a class="trip-quick-link" href="#/trips/${trip.id}/lists" data-testid="lists-quick-link">
                <span class="trip-quick-link-icon">📋</span>
                <span>${t('trip.lists')}</span>
              </a>
            </div>
            <div class="trip-main-content">
              ${lodgingSectionHtml}
              ${transportSectionHtml}
              ${diningEventsSectionHtml}
              ${timelineHtml}
            </div>
            <div class="trip-sidebar">
              <div class="suggestions-section">
                ${suggestionListHtml}
              </div>
            </div>
          </div>
          <div class="trip-map-section">
            ${mapViewHtml}
          </div>
        </div>
      </div>
    `;

    // Attach timeline listeners with inline editing support
    const timelineContainer = container.querySelector('.itinerary-timeline');
    attachTimelineListeners(timelineContainer, {
      onAddActivity: handleAddActivity,
      onEditActivity: handleEditActivity,
      onDeleteActivity: handleDeleteActivity,
      onSaveActivity: handleSaveActivityField,
    });

    // US4: Attach reservation section listeners with inline editing
    const mainContent = container.querySelector('.trip-main-content');
    if (mainContent) {
      attachReservationSectionListeners(mainContent, {
        onAddLodging: () => handleAddReservation('hotel'),
        onAddTransport: () => handleAddReservation('flight'),
        onAddDiningEvent: () => handleAddReservation('restaurant'),
        onSave: handleSaveReservationField,
        onDelete: handleDeleteReservation,
        onTypeChange: handleReservationTypeChange,
        onSaveComplete: handleReservationSaveComplete,
      });
    }

    // Attach suggestion listeners
    attachSuggestionListeners();

    // Attach trip buddy listeners
    attachTripBuddyListeners();

    // Initialize drag-and-drop
    if (timelineContainer) {
      // Add drag-drop styles if not already added
      if (!document.getElementById('drag-drop-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'drag-drop-styles';
        addDragDropStyles();
      }

      sortableInstances = initializeDragDrop(timelineContainer, handleReorder, handleActivityDateChange);
    }

    // T187-T189: Initialize map and attach map listeners
    await initializeMapView(activities);
    attachMapListeners();

    // Attach edit trip button
    container.querySelector('[data-action="edit-trip"]')?.addEventListener('click', () => {
      showTripModal(trip);
    });

    // Attach delete trip button
    container.querySelector('[data-action="delete-trip"]')?.addEventListener('click', () => {
      handleDeleteTrip(trip);
    });

    // Attach export trip button (opens modal)
    container.querySelector('[data-action="export-trip"]')?.addEventListener('click', () => {
      showExportModal(trip);
    });

    // Attach export to Google Maps button
    container.querySelector('[data-action="export-google-maps"]')?.addEventListener('click', () => {
      handleExportGoogleMaps();
    });

    // Attach share trip button
    container.querySelector('[data-action="share-trip"]')?.addEventListener('click', () => {
      showShareDialog(trip.id);
    });

    // Attach cover image edit button
    container.querySelector('[data-action="edit-cover-image"]')?.addEventListener('click', () => {
      handleEditCoverImage();
    });

    // Attach cover image delete button
    container.querySelector('[data-action="delete-cover-image"]')?.addEventListener('click', () => {
      handleDeleteCoverImage();
    });

    // Attach trip menu toggle
    const tripMenuTrigger = container.querySelector('[data-action="toggle-trip-menu"]');
    const tripMenuDropdown = container.querySelector('.trip-menu-dropdown');

    if (tripMenuTrigger && tripMenuDropdown) {
      tripMenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = tripMenuDropdown.style.display === 'block';
        tripMenuDropdown.style.display = isVisible ? 'none' : 'block';
      });

      // Close menu when clicking outside
      document.addEventListener('click', () => {
        tripMenuDropdown.style.display = 'none';
      });

      // Prevent menu from closing when clicking inside
      tripMenuDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Handle cover image file input change
    const coverImageInput = container.querySelector('#cover-image-input');
    if (coverImageInput) {
      // Remove any existing listeners by cloning the element
      const newInput = coverImageInput.cloneNode(true);
      coverImageInput.parentNode.replaceChild(newInput, coverImageInput);

      // Add the change listener to the new element
      newInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await handleCoverImageUpload(file);
        }
        // Reset the input so the same file can be selected again
        e.target.value = '';
      });
    }

    // T116: Wire presence updates - Join trip room and subscribe to presence changes
    joinTripRoom(tripId);
    subscribeToPresenceUpdates();
    subscribeToSuggestionUpdates();
    subscribeToActivityUpdates(); // T152: Subscribe to activity real-time updates

  } catch (error) {
    // T084: Error handling for API calls
    console.error('Failed to load trip:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('trip.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <a href="#/" class="btn btn-sm btn-primary">${t('common.back')}</a>
      </div>
    `;
  }
}

/**
 * Cleanup function when leaving page
 */
export function cleanupTripDetailPage() {
  if (sortableInstances.length > 0) {
    destroyDragDrop(sortableInstances);
    sortableInstances = [];
  }

  // US3: Cleanup map
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }

  // T116: Cleanup presence updates
  if (presenceUnsubscribe) {
    presenceUnsubscribe();
    presenceUnsubscribe = null;
  }

  // Cleanup suggestion updates
  if (suggestionUnsubscribe) {
    suggestionUnsubscribe();
    suggestionUnsubscribe = null;
  }

  // T154: Cleanup activity updates
  if (activityUnsubscribe) {
    activityUnsubscribe();
    activityUnsubscribe = null;
  }

  // Cleanup trip buddy updates
  if (tripBuddyUnsubscribe) {
    tripBuddyUnsubscribe();
    tripBuddyUnsubscribe = null;
  }
  tripBuddyState.clear();

  // Leave trip room
  if (currentTrip) {
    wsClient.leaveTrip(currentTrip.id);
  }

  // Reset state
  activeUsers = [];
  currentSuggestions = [];
  currentTripBuddies = [];
}

/**
 * Handle add activity - creates inline activity directly
 * @param {string} defaultDate - Default date for activity
 */
async function handleAddActivity(defaultDate) {
  if (!currentTrip) return;

  try {
    // Build startTime from the date if provided
    const startTime = defaultDate ? `${defaultDate}T12:00:00.000Z` : null;

    // Calculate orderIndex to place at the end of the day's activities
    let maxOrderIndex = 0;
    currentActivities.forEach(activity => {
      // Check if activity is on the same day (or both are undated)
      const activityDate = activity.startTime ? activity.startTime.split('T')[0] : null;
      if (activityDate === defaultDate || (!activityDate && !defaultDate)) {
        if (activity.orderIndex > maxOrderIndex) {
          maxOrderIndex = activity.orderIndex;
        }
      }
    });

    // Create a new activity with default values
    const newActivity = await tripState.createActivity(currentTrip.id, {
      type: 'sightseeing',
      title: t('activity.newActivity'),
      startTime,
      orderIndex: maxOrderIndex + 1,
    });

    // Mark this ID as pending so WebSocket handler knows we're handling it
    pendingActivityIds.add(newActivity.id);

    // Add to current activities list (only if not already present)
    if (!currentActivities.find(a => a.id === newActivity.id)) {
      currentActivities.push(newActivity);
    }

    // Refresh the timeline to show the new activity
    refreshTimeline();

    // Auto-expand the new activity card for editing
    setTimeout(() => {
      const card = document.querySelector(`.activity-card[data-activity-id="${newActivity.id}"]`);
      if (card) {
        const details = card.querySelector('.activity-card-details');
        const chevron = card.querySelector('.activity-chevron');
        if (details && chevron) {
          details.style.display = 'block';
          chevron.textContent = '▼';
          card.classList.add('expanded');
          // Scroll to the new card
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      // Clear the pending flag after a delay (WebSocket event should have arrived by now)
      setTimeout(() => {
        pendingActivityIds.delete(newActivity.id);
      }, 2000);
    }, 100);
  } catch (error) {
    console.error('Failed to create activity:', error);
    showToast(t('activity.createFailed'), 'error');
  }
}

/**
 * Handle edit activity - expands the activity card for inline editing
 * @param {string} activityId - Activity ID
 */
function handleEditActivity(activityId) {
  const card = document.querySelector(`.activity-card[data-activity-id="${activityId}"]`);
  if (card) {
    const details = card.querySelector('.activity-card-details');
    const chevron = card.querySelector('.activity-chevron');
    if (details && chevron) {
      details.style.display = 'block';
      chevron.textContent = '▼';
      card.classList.add('expanded');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * Handle delete activity (T082: Wire activity creation flow)
 * @param {string} activityId - Activity ID
 */
async function handleDeleteActivity(activityId) {
  try {
    // T084: Error handling with user feedback
    await tripState.deleteActivity(activityId);

    // Remove from current activities and refresh timeline (no page reload)
    currentActivities = currentActivities.filter(a => a.id !== activityId);
    refreshTimeline();
    showToast(t('activity.deleted'), 'success');
  } catch (error) {
    console.error('Failed to delete activity:', error);
    showToast(t('activity.deleteFailed'), 'error');
  }
}

/**
 * Handle inline save of a single activity field
 * @param {string} activityId - Activity ID
 * @param {string} fieldName - Name of the field being updated
 * @param {string} newValue - New value for the field
 * @param {Object} options - Optional settings (silent: boolean to suppress toast)
 */
async function handleSaveActivityField(activityId, fieldName, newValue, options = {}) {
  const activity = currentActivities.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error('Activity not found');
  }

  // Build the update payload based on field name
  const updates = {};

  if (fieldName === 'title') {
    updates.title = newValue;
  } else if (fieldName === 'type') {
    updates.type = newValue;
  } else if (fieldName === 'location') {
    updates.location = newValue || null;
  } else if (fieldName === 'description') {
    updates.description = newValue || null;
  } else if (fieldName === 'latitude') {
    updates.latitude = newValue ? parseFloat(newValue) : null;
  } else if (fieldName === 'longitude') {
    updates.longitude = newValue ? parseFloat(newValue) : null;
  } else if (fieldName === 'startTime') {
    // Convert from datetime-local format to ISO
    updates.startTime = newValue ? new Date(newValue).toISOString() : null;
  } else if (fieldName === 'endTime') {
    // Convert from datetime-local format to ISO
    updates.endTime = newValue ? new Date(newValue).toISOString() : null;
  } else {
    // Unknown field - skip
    console.warn('Unknown activity field:', fieldName);
    return;
  }

  // Only make API call if we have updates
  if (Object.keys(updates).length > 0) {
    try {
      await tripState.updateActivity(activityId, updates);
      if (!options.silent) {
        showToast(t('activity.saved'), 'success');
      }
    } catch (error) {
      console.error('Failed to save activity field:', error);
      if (!options.silent) {
        showToast(t('activity.saveFailed'), 'error');
      }
      throw error;
    }
  }
}

/**
 * US4: Handle add reservation - creates inline reservation directly
 * @param {string} defaultType - Default reservation type (hotel, flight, restaurant, etc.)
 */
// Track IDs of activities we're currently creating to prevent WebSocket duplicates
const pendingActivityIds = new Set();

async function handleAddReservation(defaultType) {
  if (!currentTrip) return;

  try {
    // Create a new reservation with default values
    const newReservation = await tripState.createActivity(currentTrip.id, {
      type: defaultType,
      title: t('reservation.new', { type: getTypeLabel(defaultType) }),
      metadata: {
        isReservation: true,
        reservationType: defaultType,
      },
    });

    // Mark this ID as pending so WebSocket handler knows we're handling it
    pendingActivityIds.add(newReservation.id);

    // Add to current activities list (only if not already present)
    if (!currentActivities.find(a => a.id === newReservation.id)) {
      currentActivities.push(newReservation);
    }

    // Refresh the timeline to show the new reservation
    refreshTimeline();

    // Auto-expand the new reservation card for editing
    setTimeout(() => {
      const card = document.querySelector(`.inline-reservation-card[data-id="${newReservation.id}"]`);
      if (card) {
        const details = card.querySelector('.inline-reservation-details');
        const chevron = card.querySelector('.inline-reservation-chevron');
        if (details && chevron) {
          details.style.display = 'block';
          chevron.textContent = '▼';
          card.classList.add('expanded');
          // Scroll to the new card
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      // Clear the pending flag after a delay (WebSocket event should have arrived by now)
      setTimeout(() => {
        pendingActivityIds.delete(newReservation.id);
      }, 2000);
    }, 100);
  } catch (error) {
    console.error('Failed to create reservation:', error);
  }
}

/**
 * Get human-readable label for a type
 * @param {string} type - Reservation type
 * @returns {string} Label
 */
function getTypeLabel(type) {
  // Use i18n for reservation types
  const translationKey = `reservation.types.${type}`;
  const translated = t(translationKey);
  // If translation exists (not same as key), return it; otherwise return type as-is
  return translated !== translationKey ? translated : type;
}

/**
 * US4: Handle inline save of a reservation field
 * @param {string} reservationId - Reservation (activity) ID
 * @param {string} reservationType - Type of reservation (flight, accommodation, etc.)
 * @param {string} fieldName - Name of the field being updated
 * @param {string} newValue - New value for the field
 * @param {Object} options - Optional settings (silent: boolean to suppress toast)
 */
async function handleSaveReservationField(reservationId, reservationType, fieldName, newValue, options = {}) {
  const reservation = currentActivities.find((a) => a.id === reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  // Build the update payload based on field name
  const updates = {};
  const metadataUpdates = { ...reservation.metadata };

  // Handle different field types
  if (fieldName === 'title') {
    updates.title = newValue;
  } else if (fieldName === 'type') {
    updates.type = newValue;
  } else if (fieldName === 'location') {
    updates.location = newValue || null;
  } else if (fieldName === 'description') {
    updates.description = newValue || null;
  } else if (fieldName === 'confirmationCode') {
    metadataUpdates.confirmationCode = newValue || null;
  } else if (fieldName === 'provider') {
    metadataUpdates.provider = newValue || null;
  } else if (fieldName === 'flightNumber') {
    metadataUpdates.flightNumbers = newValue ? [newValue] : [];
  } else if (fieldName === 'trainNumber') {
    metadataUpdates.trainNumber = newValue || null;
  } else if (fieldName === 'seatClass') {
    metadataUpdates.seatClass = newValue || null;
  } else if (fieldName === 'origin') {
    metadataUpdates.origin = newValue || null;
  } else if (fieldName === 'destination') {
    metadataUpdates.destination = newValue || null;
  } else if (fieldName === 'hotelName') {
    metadataUpdates.hotelName = newValue || null;
  } else if (fieldName === 'vehicleType') {
    metadataUpdates.vehicleType = newValue || null;
  } else if (fieldName === 'pickupLocation') {
    metadataUpdates.pickupLocation = newValue || null;
  } else if (fieldName === 'restaurantName') {
    metadataUpdates.restaurantName = newValue || null;
  } else if (fieldName === 'departureDate') {
    updates.startTime = newValue ? buildIsoDateTime(newValue, metadataUpdates.departureTime) : null;
  } else if (fieldName === 'departureTime') {
    metadataUpdates.departureTime = newValue || null;
    const dateField = reservation.startTime ? reservation.startTime.split('T')[0] : null;
    if (dateField) {
      updates.startTime = buildIsoDateTime(dateField, newValue);
    }
  } else if (fieldName === 'checkInDate') {
    metadataUpdates.checkInDate = newValue || null;
    updates.startTime = newValue ? `${newValue}T14:00:00.000Z` : null;
  } else if (fieldName === 'checkOutDate') {
    metadataUpdates.checkOutDate = newValue || null;
    updates.endTime = newValue ? `${newValue}T11:00:00.000Z` : null;
  } else if (fieldName === 'pickupDate') {
    metadataUpdates.pickupDate = newValue || null;
    updates.startTime = newValue ? `${newValue}T10:00:00.000Z` : null;
  } else if (fieldName === 'dropoffDate') {
    metadataUpdates.dropoffDate = newValue || null;
    updates.endTime = newValue ? `${newValue}T10:00:00.000Z` : null;
  } else if (fieldName === 'reservationDate') {
    metadataUpdates.reservationDate = newValue || null;
    updates.startTime = newValue ? buildIsoDateTime(newValue, metadataUpdates.reservationTime) : null;
  } else if (fieldName === 'reservationTime') {
    metadataUpdates.reservationTime = newValue || null;
    const dateField = metadataUpdates.reservationDate || (reservation.startTime ? reservation.startTime.split('T')[0] : null);
    if (dateField) {
      updates.startTime = buildIsoDateTime(dateField, newValue);
    }
  } else if (fieldName === 'eventDate') {
    const timeField = reservation.startTime ? reservation.startTime.split('T')[1]?.substring(0, 5) : null;
    updates.startTime = newValue ? buildIsoDateTime(newValue, timeField) : null;
  } else if (fieldName === 'eventTime') {
    const dateField = reservation.startTime ? reservation.startTime.split('T')[0] : null;
    if (dateField) {
      updates.startTime = buildIsoDateTime(dateField, newValue);
    }
  } else if (fieldName === 'startDate') {
    // Generic 'other' type start date
    updates.startTime = newValue ? `${newValue}T12:00:00.000Z` : null;
  } else if (fieldName === 'endDate') {
    // Generic 'other' type end date
    updates.endTime = newValue ? `${newValue}T12:00:00.000Z` : null;
  } else if (fieldName === 'partySize') {
    metadataUpdates.partySize = newValue ? parseInt(newValue, 10) : null;
  } else if (fieldName === 'latitude') {
    updates.latitude = newValue ? parseFloat(newValue) : null;
  } else if (fieldName === 'longitude') {
    updates.longitude = newValue ? parseFloat(newValue) : null;
  } else {
    // Generic metadata field
    metadataUpdates[fieldName] = newValue || null;
  }

  // Always include metadata if we made any metadata updates
  if (Object.keys(metadataUpdates).length > 0) {
    updates.metadata = metadataUpdates;
  }

  // Only make API call if we have updates
  if (Object.keys(updates).length > 0) {
    try {
      const updatedActivity = await tripState.updateActivity(reservationId, updates);
      // Update our local copy with the server response
      const index = currentActivities.findIndex(a => a.id === reservationId);
      if (index !== -1 && updatedActivity) {
        currentActivities[index] = updatedActivity;
      }
      if (!options.silent) {
        showToast(t('activity.saved'), 'success');
      }
    } catch (error) {
      console.error('Failed to save reservation field:', error);
      if (!options.silent) {
        showToast(t('activity.saveFailed'), 'error');
      }
      throw error;
    }
  }
}

/**
 * US4: Handle reservation save complete - refresh timeline if date changed for reordering
 * @param {string} reservationId - Reservation (activity) ID
 * @param {Map} savedChanges - Map of field names to saved values
 */
function handleReservationSaveComplete(reservationId, savedChanges) {
  // Check if any date-related field was changed that affects ordering
  const dateFields = ['departureDate', 'checkInDate', 'pickupDate', 'reservationDate', 'eventDate', 'startDate'];

  for (const [fieldName] of savedChanges) {
    if (dateFields.includes(fieldName)) {
      // A date field changed, refresh to reorder by date
      refreshTimeline();
      return;
    }
  }
}

/**
 * US4: Handle reservation type change - refresh to show new type-specific fields
 * @param {string} reservationId - Reservation (activity) ID
 * @param {string} newType - New reservation type
 */
async function handleReservationTypeChange(reservationId, newType) {
  // Update the local activity's type
  const reservation = currentActivities.find((a) => a.id === reservationId);
  if (reservation) {
    reservation.type = newType;
  }
  // Refresh the timeline to re-render with new type-specific fields
  refreshTimeline();
}

/**
 * Build ISO datetime string from date and time
 */
function buildIsoDateTime(date, time) {
  if (!date) return null;
  if (time) {
    return `${date}T${time}:00.000Z`;
  }
  return `${date}T12:00:00.000Z`;
}

/**
 * US4: Handle delete reservation
 * @param {string} reservationId - Reservation (activity) ID
 */
async function handleDeleteReservation(reservationId) {
  const confirmed = confirm(t('reservation.confirmDelete'));
  if (!confirmed) return;

  try {
    await tripState.deleteActivity(reservationId);

    // Remove from current activities and refresh timeline (no page reload)
    currentActivities = currentActivities.filter(a => a.id !== reservationId);
    refreshTimeline();
    showToast(t('reservation.deleted'), 'success');
  } catch (error) {
    console.error('Failed to delete reservation:', error);
    showToast(t('reservation.deleteFailed'), 'error');
  }
}

/**
 * Handle activity reorder (T083: Wire drag-and-drop reorder flow)
 * @param {Array} activities - Array of {id, orderIndex}
 */
async function handleReorder(activities) {
  try {
    // T083: Save new order to API
    await tripState.reorderActivities(currentTrip.id, activities);
  } catch (error) {
    // T084: Error handling
    console.error('Failed to reorder activities:', error);
    throw error;
  }
}

/**
 * Handle activity date change when dragged to a different day
 * @param {string} activityId - Activity ID
 * @param {string} newDate - New date (YYYY-MM-DD format)
 */
async function handleActivityDateChange(activityId, newDate) {
  try {
    // Find the activity to get its current time
    const activity = currentActivities.find(a => a.id === activityId);
    if (!activity) {
      console.error('Activity not found:', activityId);
      return;
    }

    // Parse the current startTime to preserve the time portion
    let newStartTime;
    let newEndTime = null;

    if (activity.startTime) {
      const currentStart = new Date(activity.startTime);
      const [year, month, day] = newDate.split('-').map(Number);
      currentStart.setFullYear(year, month - 1, day);
      newStartTime = currentStart.toISOString();

      // If there's an endTime, adjust it to maintain the same duration
      if (activity.endTime) {
        const currentEnd = new Date(activity.endTime);
        const duration = currentEnd.getTime() - new Date(activity.startTime).getTime();
        newEndTime = new Date(currentStart.getTime() + duration).toISOString();
      }
    } else {
      // No existing startTime, set to noon on the new date
      newStartTime = new Date(`${newDate}T12:00:00`).toISOString();
    }

    // Update the activity with new dates
    const updates = { startTime: newStartTime };
    if (newEndTime) {
      updates.endTime = newEndTime;
    }

    await tripState.updateActivity(activityId, updates);

    // Update local state
    if (activity) {
      activity.startTime = newStartTime;
      if (newEndTime) {
        activity.endTime = newEndTime;
      }
    }

    showToast(t('activity.movedToDate'), 'success');
  } catch (error) {
    console.error('Failed to update activity date:', error);
    showToast(t('activity.moveFailed'), 'error');
    throw error;
  }
}

/**
 * Get cover image URL with default fallback
 * T042: Updated to use single placeholder instead of gradient covers
 * @param {Object} trip - Trip object
 * @returns {string} Cover image URL
 */
function getCoverImageUrl(trip) {
  if (trip.coverImageUrl) {
    return trip.coverImageUrl;
  }

  // Use placeholder image for trips without cover
  return '/images/placeholder-trip.svg';
}

/**
 * T031: Render cover image attribution
 * @param {Object} trip - Trip object
 * @returns {string} Attribution HTML
 */
function renderCoverImageAttribution(trip) {
  const attribution = trip.coverImageAttribution;

  // No attribution if not available or if source is placeholder
  if (!attribution || attribution.source === 'placeholder') {
    return '';
  }

  // Don't show attribution for user-uploaded images
  if (attribution.source === 'user_upload') {
    return '';
  }

  // Render Pexels attribution
  if (attribution.source === 'pexels') {
    return `
      <div class="cover-image-attribution">
        <span class="attribution-text">
          ${t('cover.photoBy', 'Photo by')}
          <a href="${escapeHtml(attribution.photographerUrl)}" target="_blank" rel="noopener noreferrer" class="attribution-link">
            ${escapeHtml(attribution.photographer)}
          </a>
          ${t('cover.on', 'on')}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" class="attribution-link">
            Pexels
          </a>
        </span>
      </div>
    `;
  }

  return '';
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

/**
 * T116: Join trip room for real-time updates
 * @param {string} tripId - Trip ID
 */
function joinTripRoom(tripId) {
  if (wsClient.isConnected && wsClient.isAuthenticated) {
    wsClient.joinTrip(tripId);
  } else {
    // Wait for connection and authentication
    wsClient.connect()
      .then(() => wsClient.joinTrip(tripId))
      .catch((error) => {
        console.error('Failed to join trip room:', error);
      });
  }
}

/**
 * T116: Subscribe to presence updates
 */
function subscribeToPresenceUpdates() {
  // Initialize realtime manager to register WebSocket event handlers
  realtimeManager.init();

  // Subscribe to presence changes from realtime update manager
  presenceUnsubscribe = realtimeManager.onPresenceUpdate((presenceData) => {
    activeUsers = presenceData.activeUsers || [];
    updatePresenceIndicator();
  });

  // Also listen for room:joined event to get initial presence
  wsClient.on('room:joined', (message) => {
    if (message.activeUsers) {
      activeUsers = message.activeUsers;
      updatePresenceIndicator();
    }
  });
}

/**
 * T116: Update presence indicator in the UI
 */
function updatePresenceIndicator() {
  // Update presence indicators on existing badges (sidebar - without full re-render)
  const tripBuddyItems = document.querySelectorAll('.trip-buddy-item-compact');

  tripBuddyItems.forEach(item => {
    const userId = item.getAttribute('data-user-id');
    const badge = item.querySelector('.trip-buddy-avatar-badge');

    if (!badge) {
      return;
    }

    const existingIndicator = badge.querySelector('.presence-indicator');
    const isActive = activeUsers.includes(userId);

    if (isActive && !existingIndicator) {
      // Add presence indicator
      badge.classList.add('is-active');
      const indicator = document.createElement('span');
      indicator.className = 'presence-indicator';
      badge.appendChild(indicator);
    } else if (!isActive && existingIndicator) {
      // Remove presence indicator
      badge.classList.remove('is-active');
      existingIndicator.remove();
    }
  });

  // Update presence indicators in overlay compact list
  const compactAvatars = document.querySelectorAll('.trip-buddies-inline .trip-buddy-avatar[data-user-id]');

  compactAvatars.forEach(avatar => {
    const userId = avatar.getAttribute('data-user-id');
    const existingIndicator = avatar.querySelector('.presence-indicator');

    // Skip if userId is invalid
    if (!userId || userId === 'undefined') {
      return;
    }

    // Convert to strings for comparison
    const isActive = activeUsers.map(String).includes(String(userId));

    if (isActive && !existingIndicator) {
      // Add presence indicator
      avatar.classList.add('is-active');
      const indicator = document.createElement('span');
      indicator.className = 'presence-indicator';
      avatar.appendChild(indicator);
    } else if (!isActive && existingIndicator) {
      // Remove presence indicator
      avatar.classList.remove('is-active');
      existingIndicator.remove();
    }
  });
}

/**
 * T153: Subscribe to activity updates from WebSocket
 */
function subscribeToActivityUpdates() {
  // Subscribe to activity changes from realtime update manager
  activityUnsubscribe = realtimeManager.onActivityUpdate((event) => {
    if (event.type === 'created') {
      // New activity added by another user
      handleActivityCreatedEvent(event);
    } else if (event.type === 'updated') {
      // Activity updated by another user
      handleActivityUpdatedEvent(event);
    } else if (event.type === 'deleted') {
      // Activity deleted by another user
      handleActivityDeletedEvent(event);
    } else if (event.type === 'reordered') {
      // Activities reordered by another user
      handleActivityReorderedEvent(event);
    }
  });
}

/**
 * T153: Handle new activity created via WebSocket
 * This is for activities created by OTHER users - when we create locally,
 * we handle the update ourselves
 */
function handleActivityCreatedEvent(event) {
  // Skip if we created this activity ourselves (it's already in our list from the API response)
  if (pendingActivityIds.has(event.activity?.id)) {
    return;
  }

  // Skip if already present (race condition protection)
  if (!event.activity || currentActivities.find((a) => a.id === event.activity.id)) {
    return;
  }

  // This is a new activity from another user - add it and refresh
  currentActivities.push(event.activity);
  refreshTimeline();
}

/**
 * T153: Handle activity updated via WebSocket
 */
function handleActivityUpdatedEvent(event) {
  console.log('[ACTIVITY DEBUG] handleActivityUpdatedEvent called:', event);
  // Update activity in the list
  const index = currentActivities.findIndex((a) => a.id === event.activityId);
  console.log('[ACTIVITY DEBUG] Found activity at index:', index, 'Total activities:', currentActivities.length);
  if (index !== -1 && event.activity) {
    currentActivities[index] = event.activity;
    console.log('[ACTIVITY DEBUG] Updated activity, refreshing timeline');
    refreshTimeline();
  }
}

/**
 * T153: Handle activity deleted via WebSocket
 */
function handleActivityDeletedEvent(event) {
  // Remove activity from the list
  currentActivities = currentActivities.filter((a) => a.id !== event.activityId);
  refreshTimeline();
}

/**
 * T153: Handle activities reordered via WebSocket
 */
function handleActivityReorderedEvent(event) {
  // Update order indexes from the event, but preserve all activities
  // (including reservations that might not be in the reordered list)
  if (event.activities && Array.isArray(event.activities)) {
    // Create a map of new order indexes
    const orderMap = new Map();
    event.activities.forEach((a, index) => {
      orderMap.set(a.id, a.orderIndex !== undefined ? a.orderIndex : index);
    });

    // Update order indexes in current activities
    currentActivities.forEach(activity => {
      if (orderMap.has(activity.id)) {
        activity.orderIndex = orderMap.get(activity.id);
      }
    });

    refreshTimeline();
  }
}

/**
 * Refresh the timeline UI with current activities
 */
function refreshTimeline() {
  const mainContent = document.querySelector('.trip-main-content');

  if (mainContent && currentTrip) {
    // Deduplicate currentActivities by ID (protection against race conditions)
    const seenIds = new Set();
    currentActivities = currentActivities.filter(a => {
      if (seenIds.has(a.id)) {
        return false; // Remove duplicate
      }
      seenIds.add(a.id);
      return true;
    });

    // US4: Regenerate reservation sections along with timeline
    // Update trip date constraints for reservation forms
    setTripDateConstraints(currentTrip);
    const lodgingSectionHtml = createLodgingSection(currentActivities);
    const transportSectionHtml = createTransportationSection(currentActivities);
    const diningEventsSectionHtml = createDiningEventsSection(currentActivities);

    // Filter out reservation activities for the timeline
    const nonReservationActivities = currentActivities.filter(a => !a.metadata?.isReservation);
    const timelineHtml = createItineraryTimeline(nonReservationActivities, currentTrip);

    mainContent.innerHTML = `
      ${lodgingSectionHtml}
      ${transportSectionHtml}
      ${diningEventsSectionHtml}
      ${timelineHtml}
    `;

    // Reattach timeline listeners
    const timelineContainer = mainContent.querySelector('.itinerary-timeline');
    if (timelineContainer) {
      attachTimelineListeners(timelineContainer, {
        onAddActivity: handleAddActivity,
        onEditActivity: handleEditActivity,
        onDeleteActivity: handleDeleteActivity,
        onSaveActivity: handleSaveActivityField,
      });

      // Reinitialize drag and drop
      if (sortableInstances.length > 0) {
        destroyDragDrop(sortableInstances);
        sortableInstances = [];
      }
      sortableInstances = initializeDragDrop(timelineContainer, handleReorder, handleActivityDateChange);
    }

    // US4: Reattach reservation section listeners
    attachReservationSectionListeners(mainContent, {
      onAddLodging: () => handleAddReservation('hotel'),
      onAddTransport: () => handleAddReservation('flight'),
      onAddDiningEvent: () => handleAddReservation('restaurant'),
      onSave: handleSaveReservationField,
      onDelete: handleDeleteReservation,
      onTypeChange: handleReservationTypeChange,
      onSaveComplete: handleReservationSaveComplete,
    });

    // US3: Update map when timeline changes
    updateMap();
  }
}

/**
 * Subscribe to suggestion updates from WebSocket
 */
function subscribeToSuggestionUpdates() {
  // Subscribe to suggestion changes from realtime update manager
  suggestionUnsubscribe = realtimeManager.onSuggestionUpdate((event) => {
    if (event.type === 'created') {
      // New suggestion added
      handleSuggestionCreatedEvent(event);
    } else if (event.type === 'voted') {
      // Suggestion vote updated
      handleSuggestionVotedEvent(event);
    } else if (event.type === 'accepted' || event.type === 'rejected') {
      // Suggestion status changed
      handleSuggestionStatusChangedEvent(event);
    } else if (event.type === 'updated') {
      // Suggestion details updated
      handleSuggestionUpdatedEvent(event);
    } else if (event.type === 'deleted') {
      // Suggestion deleted
      handleSuggestionDeletedEvent(event);
    }
  });
}

/**
 * Handle new suggestion created via WebSocket
 */
function handleSuggestionCreatedEvent(event) {
  // Add to current suggestions list
  if (event.suggestion && !currentSuggestions.find((s) => s.id === event.suggestion.id)) {
    currentSuggestions.push(event.suggestion);
    updateSuggestionList();
  }
}

/**
 * Handle suggestion vote via WebSocket
 */
function handleSuggestionVotedEvent(event) {
  // Update vote counts for the suggestion
  const index = currentSuggestions.findIndex((s) => s.id === event.suggestionId);
  if (index !== -1 && event.suggestion) {
    currentSuggestions[index] = event.suggestion;
    updateSuggestionList();
  }
}

/**
 * Handle suggestion status change (accepted/rejected) via WebSocket
 */
function handleSuggestionStatusChangedEvent(event) {
  const index = currentSuggestions.findIndex((s) => s.id === event.suggestionId);
  if (index !== -1 && event.suggestion) {
    currentSuggestions[index] = event.suggestion;
    updateSuggestionList();

    // If accepted, refresh activities to show new activity
    if (event.type === 'accepted') {
      refreshActivities();
    }
  }
}

/**
 * Handle suggestion updated via WebSocket
 */
function handleSuggestionUpdatedEvent(event) {
  const index = currentSuggestions.findIndex((s) => s.id === event.suggestionId);
  if (index !== -1 && event.suggestion) {
    currentSuggestions[index] = event.suggestion;
    updateSuggestionList();
  }
}

/**
 * Handle suggestion deleted via WebSocket
 */
function handleSuggestionDeletedEvent(event) {
  currentSuggestions = currentSuggestions.filter((s) => s.id !== event.suggestionId);
  updateSuggestionList();
}

/**
 * Update suggestion list in the UI
 */
function updateSuggestionList() {
  const container = document.querySelector('.suggestions-section');
  if (container) {
    const currentUser = authState.getCurrentUser();
    const suggestionListHtml = createSuggestionList(
      currentSuggestions,
      currentUser?.id,
      'editor', // TODO: Get actual user role
      () => handleAddSuggestion()
    );
    container.innerHTML = suggestionListHtml;
    attachSuggestionListeners();
  }
}

/**
 * Refresh activities list
 */
async function refreshActivities() {
  try {
    const activities = await tripState.loadActivities(currentTrip.id);
    currentActivities = activities;

    // Use refreshTimeline which properly handles both timeline and reservation sections
    refreshTimeline();
  } catch (error) {
    console.error('Failed to refresh activities:', error);
  }
}

/**
 * Show trip edit modal
 * @param {Object} trip - Trip data to edit
 */
function showTripModal(trip) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'trip-modal';
  modalContainer.innerHTML = createTripForm(trip);
  document.body.appendChild(modalContainer);

  // Attach listeners
  attachTripFormListeners(
    modalContainer,
    async (tripData) => {
      await handleTripSubmit(tripData, trip);
    },
    () => {
      closeTripModal();
    }
  );

  // Show modal with animation
  requestAnimationFrame(() => {
    modalContainer.classList.add('active');
  });
}

/**
 * Close trip modal
 */
function closeTripModal() {
  const modalContainer = document.getElementById('trip-modal');
  if (modalContainer) {
    modalContainer.classList.remove('active');
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

/**
 * Handle trip form submission
 * @param {Object} tripData - Trip data from form
 * @param {Object} existingTrip - Existing trip being edited
 */
async function handleTripSubmit(tripData, existingTrip) {
  try {
    // Extract cover image file if present
    const coverImageFile = tripData.coverImage;

    // Remove coverImage from tripData before updating (it's not part of the PATCH endpoint)
    const { coverImage, ...tripUpdateData } = tripData;

    // Update the trip metadata
    await tripState.updateTrip(existingTrip.id, tripUpdateData);

    // If a cover image file was selected, upload it separately
    if (coverImageFile && coverImageFile instanceof File && coverImageFile.size > 0) {
      await tripState.uploadCoverImage(existingTrip.id, coverImageFile);
    }

    // Close modal
    closeTripModal();

    // Reload the trip detail page to show updated data
    await tripDetailPage({ id: existingTrip.id });
  } catch (error) {
    // Error handling - propagate to form for display
    console.error('Failed to update trip:', error);
    throw error;
  }
}

/**
 * Handle edit cover image button click
 */
function handleEditCoverImage() {
  const input = document.getElementById('cover-image-input');
  if (input) {
    input.click();
  }
}

/**
 * Handle cover image upload
 * @param {File} file - Cover image file
 */
async function handleCoverImageUpload(file) {
  if (!currentTrip) {
    return;
  }

  try {
    // Validate file
    const { validateCoverImage } = await import('../utils/validators.js');
    const validation = validateCoverImage(file);

    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    // Show loading state
    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '0.5';
    }

    // Upload cover image
    await tripState.uploadCoverImage(currentTrip.id, file);

    // Reload the page to show the new cover image
    await tripDetailPage({ id: currentTrip.id });
  } catch (error) {
    console.error('Failed to upload cover image:', error);
    alert(t('cover.uploadFailed'));

    // Reset opacity on error
    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '1';
    }
  }
}

/**
 * Handle delete cover image button click
 */
async function handleDeleteCoverImage() {
  if (!currentTrip) return;

  const confirmed = confirm(t('cover.confirmRemove'));
  if (!confirmed) return;

  try {
    // Show loading state
    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '0.5';
    }

    // Delete cover image
    await tripState.deleteCoverImage(currentTrip.id);

    // Reload the page to show the default cover image
    await tripDetailPage({ id: currentTrip.id });
  } catch (error) {
    console.error('Failed to delete cover image:', error);
    alert(t('cover.deleteFailed'));

    // Reset opacity on error
    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '1';
    }
  }
}

/**
 * Handle delete trip button click
 * @param {Object} trip - Trip to delete
 */
async function handleDeleteTrip(trip) {
  if (!trip) return;

  const confirmed = confirm(t('trip.confirmDelete', { name: trip.name }));
  if (!confirmed) return;

  try {
    // Delete the trip
    await tripState.deleteTrip(trip.id);

    // Navigate back to home page
    app.router.navigate('/');
  } catch (error) {
    console.error('Failed to delete trip:', error);
    alert(t('trip.deleteFailed'));
  }
}

/**
 * Handle export to Google Maps
 */
function handleExportGoogleMaps() {
  if (!currentActivities || currentActivities.length === 0) {
    showToast(t('map.noLocations'), 'warning');
    return;
  }

  const url = generateRouteMapsUrl(currentActivities);
  if (!url) {
    showToast(t('map.noCoordinates'), 'warning');
    return;
  }

  openInGoogleMaps(url);
  showToast(t('map.openingGoogleMaps'), 'info');
}

/**
 * Attach suggestion event listeners
 */
function attachSuggestionListeners() {
  const container = document.getElementById('page-container');

  // Add suggestion button (matches "create-suggestion" from suggestion-list.js)
  container.querySelectorAll('[data-action="create-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', () => handleAddSuggestion());
  });

  // Toggle history button
  container.querySelectorAll('[data-action="toggle-history"]').forEach((btn) => {
    btn.addEventListener('click', () => handleToggleHistory());
  });

  // Pagination buttons
  container.querySelectorAll('[data-action="prev-page"]').forEach((btn) => {
    btn.addEventListener('click', () => handleHistoryPrevPage());
  });

  container.querySelectorAll('[data-action="next-page"]').forEach((btn) => {
    btn.addEventListener('click', () => handleHistoryNextPage());
  });

  // Vote buttons
  container.querySelectorAll('[data-action="vote-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const suggestionId = e.currentTarget.dataset.suggestionId;
      const vote = e.currentTarget.dataset.vote;
      handleVoteSuggestion(suggestionId, vote);
    });
  });

  // Accept buttons
  container.querySelectorAll('[data-action="accept-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const suggestionId = e.currentTarget.dataset.suggestionId;
      handleAcceptSuggestion(suggestionId);
    });
  });

  // Reject buttons
  container.querySelectorAll('[data-action="reject-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const suggestionId = e.currentTarget.dataset.suggestionId;
      handleRejectSuggestion(suggestionId);
    });
  });

  // Delete suggestion buttons
  container.querySelectorAll('[data-action="delete-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const suggestionId = e.currentTarget.dataset.suggestionId;
      handleDeleteSuggestion(suggestionId);
    });
  });

  // Edit suggestion buttons
  container.querySelectorAll('[data-action="edit-suggestion"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const suggestionId = e.currentTarget.dataset.suggestionId;
      handleEditSuggestion(suggestionId);
    });
  });
}

/**
 * Handle toggle history button click
 */
function handleToggleHistory() {
  historyVisible = !historyVisible;
  historyCurrentPage = 1; // Reset to page 1 when toggling

  const toggleButton = document.querySelector('[data-action="toggle-history"]');
  const historySection = document.querySelector('.suggestion-history');

  if (!toggleButton || !historySection) return;

  if (historyVisible) {
    // Show history
    toggleButton.innerHTML = `<span class="icon">📜</span> ${t('suggestion.hideHistory')}`;
    toggleButton.setAttribute('aria-expanded', 'true');
    historySection.style.display = 'block';

    // Render first page
    renderHistoryPage();
  } else {
    // Hide history
    const historyCount = currentSuggestions.filter(s => s.status === 'accepted' || s.status === 'rejected').length;
    toggleButton.innerHTML = `<span class="icon">📜</span> ${t('suggestion.showHistory')} (${historyCount})`;
    toggleButton.setAttribute('aria-expanded', 'false');
    historySection.style.display = 'none';
  }
}

/**
 * Handle history previous page button click
 */
function handleHistoryPrevPage() {
  if (historyCurrentPage > 1) {
    historyCurrentPage--;
    renderHistoryPage();
  }
}

/**
 * Handle history next page button click
 */
function handleHistoryNextPage() {
  const history = currentSuggestions.filter(s => s.status === 'accepted' || s.status === 'rejected');
  const totalPages = Math.ceil(history.length / HISTORY_PER_PAGE);

  if (historyCurrentPage < totalPages) {
    historyCurrentPage++;
    renderHistoryPage();
  }
}

/**
 * Render current history page
 */
function renderHistoryPage() {
  const history = currentSuggestions.filter(s => s.status === 'accepted' || s.status === 'rejected');
  const currentUser = authState.getCurrentUser();
  const userRole = currentTrip?.userRole || 'viewer';

  const { contentHtml, paginationHtml, totalPages } = renderPaginatedHistory(
    history,
    currentUser?.id,
    userRole,
    historyCurrentPage,
    HISTORY_PER_PAGE
  );

  const contentContainer = document.querySelector('.suggestion-history-content');
  const paginationContainer = document.querySelector('.suggestion-history-pagination');

  if (contentContainer) {
    contentContainer.innerHTML = contentHtml;
  }

  if (paginationContainer) {
    paginationContainer.innerHTML = paginationHtml;
    paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';
  }

  // Re-attach suggestion listeners for the history items
  attachSuggestionListeners();
}

/**
 * Handle add suggestion button click
 */
function handleAddSuggestion() {
  showSuggestionModal();
}

/**
 * Show suggestion modal
 * @param {Object} suggestion - Existing suggestion (for edit mode)
 */
function showSuggestionModal(suggestion = null) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'suggestion-modal';
  modalContainer.innerHTML = createSuggestionForm(currentTrip);
  document.body.appendChild(modalContainer);

  // Attach form submit listener
  const form = modalContainer.querySelector('#suggestion-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSuggestionSubmit(new FormData(form), suggestion);
    });
  }

  // Attach suggestion form listeners (for dynamic date constraints)
  attachSuggestionFormListeners(modalContainer);

  // Attach cancel listeners (both close-modal buttons)
  modalContainer.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
    btn.addEventListener('click', () => closeSuggestionModal());
  });

  // Close on overlay click (clicking outside the dialog)
  const overlay = modalContainer.querySelector('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSuggestionModal();
      }
    });
  }

  // Show modal with animation
  requestAnimationFrame(() => {
    if (overlay) overlay.classList.add('open');
  });
}

/**
 * Close suggestion modal
 */
function closeSuggestionModal() {
  const modalContainer = document.getElementById('suggestion-modal');
  if (modalContainer) {
    modalContainer.classList.remove('active');
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

/**
 * Handle suggestion form submission
 * @param {FormData} formData - Form data from suggestion form
 * @param {Object} existingSuggestion - Existing suggestion (for edit mode)
 */
async function handleSuggestionSubmit(formData, existingSuggestion) {
  try {
    const suggestionData = {
      activityType: formData.get('activityType'),
      title: formData.get('title'),
    };

    // Only include optional fields if they have values
    const description = formData.get('description');
    if (description && description.trim()) {
      suggestionData.description = description.trim();
    }

    const location = formData.get('location');
    if (location && location.trim()) {
      suggestionData.location = location.trim();
    }

    const startTime = formData.get('startTime');
    if (startTime) {
      // Convert to ISO for proper storage and display
      suggestionData.startTime = new Date(startTime).toISOString();
    }

    const endTime = formData.get('endTime');
    if (endTime) {
      // Convert to ISO for proper storage and display
      suggestionData.endTime = new Date(endTime).toISOString();
    }

    if (existingSuggestion) {
      // Update existing suggestion
      await suggestionState.updateSuggestion(existingSuggestion.id, suggestionData);
    } else {
      // Create new suggestion
      await suggestionState.createSuggestion(currentTrip.id, suggestionData);
    }

    // Close modal and refresh suggestions
    closeSuggestionModal();
    await refreshSuggestions();
  } catch (error) {
    console.error('Failed to save suggestion:', error);
    alert(t('suggestion.saveFailed'));
  }
}

/**
 * Handle vote on suggestion
 * @param {string} suggestionId - Suggestion ID
 * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
 */
async function handleVoteSuggestion(suggestionId, vote) {
  try {
    await suggestionState.voteSuggestion(suggestionId, vote);
    await refreshSuggestions();
  } catch (error) {
    console.error('Failed to vote on suggestion:', error);
    alert(t('suggestion.voteFailed'));
  }
}

/**
 * Handle accept suggestion
 * @param {string} suggestionId - Suggestion ID
 */
async function handleAcceptSuggestion(suggestionId) {
  try {
    const result = await suggestionState.acceptSuggestion(suggestionId);

    // Refresh both suggestions and activities
    await Promise.all([
      refreshSuggestions(),
      tripDetailPage({ id: currentTrip.id }),
    ]);

    alert(t('suggestion.accepted'));
  } catch (error) {
    console.error('Failed to accept suggestion:', error);
    alert(t('suggestion.acceptFailed'));
  }
}

/**
 * Handle reject suggestion
 * @param {string} suggestionId - Suggestion ID
 */
async function handleRejectSuggestion(suggestionId) {
  try {
    await suggestionState.rejectSuggestion(suggestionId);
    await refreshSuggestions();
  } catch (error) {
    console.error('Failed to reject suggestion:', error);
    alert(t('suggestion.rejectFailed'));
  }
}

/**
 * Handle edit suggestion
 * @param {string} suggestionId - Suggestion ID
 */
function handleEditSuggestion(suggestionId) {
  const suggestion = currentSuggestions.find((s) => s.id === suggestionId);
  if (suggestion) {
    showSuggestionModal(suggestion);
  }
}

/**
 * Handle delete suggestion
 * @param {string} suggestionId - Suggestion ID
 */
async function handleDeleteSuggestion(suggestionId) {
  const confirmed = confirm(t('suggestion.confirmDelete'));
  if (!confirmed) return;

  try {
    await suggestionState.deleteSuggestion(suggestionId);
    await refreshSuggestions();
  } catch (error) {
    console.error('Failed to delete suggestion:', error);
    alert(t('suggestion.deleteFailed'));
  }
}

/**
 * Refresh suggestions list
 */
async function refreshSuggestions() {
  try {
    const suggestions = await suggestionState.loadSuggestions(currentTrip.id);
    currentSuggestions = suggestions;

    // Re-render suggestion list
    const container = document.querySelector('.suggestions-section');
    if (container) {
      const currentUser = authState.getCurrentUser();
      const suggestionListHtml = createSuggestionList(
        suggestions,
        currentUser?.id,
        'editor', // TODO: Get actual user role
        () => handleAddSuggestion()
      );
      container.innerHTML = suggestionListHtml;
      attachSuggestionListeners();
    }
  } catch (error) {
    console.error('Failed to refresh suggestions:', error);
  }
}

/**
 * Attach trip buddy event listeners
 */
function attachTripBuddyListeners() {
  // Invite trip buddy button
  const inviteButtons = document.querySelectorAll('[data-action="invite-trip-buddy"]');
  inviteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      showInviteTripBuddyModal();
    });
  });

  // Remove trip buddy buttons
  const removeButtons = document.querySelectorAll('[data-action="remove-trip-buddy"]');
  removeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tripBuddyId = btn.getAttribute('data-trip-buddy-id');
      if (tripBuddyId) {
        await handleRemoveTripBuddy(tripBuddyId);
      }
    });
  });
}

/**
 * Show invite trip buddy modal
 */
function showInviteTripBuddyModal() {
  if (!currentTrip) return;

  const modalHtml = createInviteTripBuddyModal(currentTrip.id);
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer.firstElementChild);

  // Attach modal event listeners
  const modal = document.getElementById('invite-trip-buddy-modal');
  if (!modal) return;

  // Close button
  const closeButtons = modal.querySelectorAll('[data-action="close-modal"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', closeInviteTripBuddyModal);
  });

  // Form submit
  const form = document.getElementById('invite-trip-buddy-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      await handleInviteTripBuddy(formData);
    });
  }

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeInviteTripBuddyModal();
    }
  });

  // Add open class for animation
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });
}

/**
 * Close invite trip buddy modal
 */
function closeInviteTripBuddyModal() {
  const modal = document.getElementById('invite-trip-buddy-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Handle invite trip buddy form submission
 * @param {FormData} formData - Form data
 */
async function handleInviteTripBuddy(formData) {
  try {
    // Validate form
    const validation = validateInviteTripBuddyForm(formData);
    if (!validation.valid) {
      displayFormErrors(validation.errors);
      return;
    }

    const tripBuddyData = {
      email: formData.get('email').trim(),
      role: formData.get('role'),
    };

    // Invite trip buddy
    await tripBuddyState.inviteTripBuddy(currentTrip.id, tripBuddyData);

    // Close modal and refresh
    closeInviteTripBuddyModal();
    await refreshTripBuddies();

    // Show success message
    showToast(t('tripBuddy.inviteSuccess'), 'success');
  } catch (error) {
    console.error('Failed to invite trip buddy:', error);
    showToast(error.message || t('tripBuddy.inviteFailed'), 'error');
  }
}

/**
 * Handle remove trip buddy
 * @param {string} tripBuddyId - Trip buddy ID
 */
async function handleRemoveTripBuddy(tripBuddyId) {
  try {
    const confirmed = confirm(t('tripBuddy.confirmRemove'));
    if (!confirmed) return;

    await tripBuddyState.removeTripBuddy(tripBuddyId);
    await refreshTripBuddies();

    showToast(t('tripBuddy.removeSuccess'), 'success');
  } catch (error) {
    console.error('Failed to remove trip buddy:', error);
    showToast(error.message || t('tripBuddy.removeFailed'), 'error');
  }
}

/**
 * Refresh tripBuddies list
 */
async function refreshTripBuddies() {
  try {
    if (!currentTrip) return;

    const tripBuddies = await tripBuddyState.loadTripBuddies(currentTrip.id);
    currentTripBuddies = tripBuddies;

    const currentUser = authState.getCurrentUser();
    const isOwner = currentTrip.ownerId === currentUser?.id;

    // Re-render trip buddy list in sidebar
    const tripBuddiesContainer = document.getElementById('trip-buddies-container');
    if (tripBuddiesContainer) {
      const tripBuddyListHtml = createTripBuddyList(
        tripBuddies,
        currentTrip.ownerId,
        currentUser?.id,
        isOwner,
        activeUsers
      );
      tripBuddiesContainer.innerHTML = tripBuddyListHtml;
      attachTripBuddyListeners();
    }

    // Also update compact trip buddy list in overlay
    const tripBuddiesInline = document.querySelector('.trip-buddies-inline');
    if (tripBuddiesInline) {
      const tripBuddyCompactHtml = createCompactTripBuddyList(
        tripBuddies,
        currentUser?.id,
        isOwner,
        activeUsers
      );
      tripBuddiesInline.innerHTML = tripBuddyCompactHtml;
    }
  } catch (error) {
    console.error('Failed to refresh tripBuddies:', error);
  }
}

/**
 * US3: Initialize map view with activities
 * @param {Array} activities - Activities with coordinates
 */
/**
 * T188: Initialize map view with activities
 * Always shows map - world view when no activities with coordinates
 */
async function initializeMapView(activities) {
  // Clean up existing map if any
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }

  // Initialize map with activities (or empty for world view)
  try {
    mapInstance = await initializeMap('trip-map', activities, {
      onMarkerClick: (activity) => {
        // When a marker is clicked, scroll to and expand the corresponding card
        scrollToAndExpandCard(activity.id);
      },
      showRoute: true
    });
  } catch (error) {
    console.error('Failed to initialize map:', error);
    showToast(t('map.loadFailed'), 'error');
  }
}

/**
 * Scroll to and expand a card (activity or reservation) by ID
 * @param {string} activityId - The activity/reservation ID
 */
function scrollToAndExpandCard(activityId) {
  const container = document.getElementById('page-container');
  if (!container) return;

  // Try to find as an activity card first
  let card = container.querySelector(`.activity-card[data-activity-id="${activityId}"]`);

  // If not found, try as a reservation card
  if (!card) {
    card = container.querySelector(`.inline-reservation-card[data-id="${activityId}"]`);
  }

  if (!card) {
    console.warn(`Card not found for activity ID: ${activityId}`);
    return;
  }

  // Scroll the card into view with smooth animation
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Expand the card after a short delay to let scrolling complete
  setTimeout(() => {
    // Check if already expanded
    if (card.classList.contains('expanded')) {
      // Add a highlight effect to draw attention
      card.classList.add('highlight');
      setTimeout(() => card.classList.remove('highlight'), 1000);
      return;
    }

    // Expand the card
    if (card.classList.contains('activity-card')) {
      // Activity card - simulate click on header to expand
      const header = card.querySelector('.activity-card-header');
      if (header) {
        header.click();
      }
    } else if (card.classList.contains('inline-reservation-card')) {
      // Reservation card - simulate click on header to expand
      const header = card.querySelector('.inline-reservation-header');
      if (header) {
        header.click();
      }
    }

    // Add highlight effect
    card.classList.add('highlight');
    setTimeout(() => card.classList.remove('highlight'), 1000);
  }, 300);
}

/**
 * T185-T186: Attach map control event listeners
 */
function attachMapListeners() {
  const container = document.getElementById('page-container');

  // Fit bounds button
  const fitBoundsBtn = container.querySelector('[data-action="fit-bounds"]');
  if (fitBoundsBtn) {
    fitBoundsBtn.addEventListener('click', () => {
      if (mapInstance) {
        mapInstance.fitBounds();
      }
    });
  }

  // Toggle route visibility
  const toggleRouteBtn = container.querySelector('[data-action="toggle-route"]');
  if (toggleRouteBtn) {
    toggleRouteBtn.addEventListener('click', () => {
      if (mapInstance) {
        mapInstance.toggleRoute();
      }
    });
  }

  // T183: Toggle distance measurement mode
  const toggleDistanceBtn = container.querySelector('[data-action="toggle-distance-mode"]');
  if (toggleDistanceBtn) {
    toggleDistanceBtn.addEventListener('click', () => {
      if (mapInstance) {
        mapInstance.toggleDistanceMode();
      }
    });
  }

  // Route optimization
  const optimizeBtn = container.querySelector('[data-action="optimize-route"]');
  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', async () => {
      await handleOptimizeRoute();
    });
  }

  // Google Maps export
  const exportBtn = container.querySelector('[data-action="export-google-maps"]');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      handleExportToGoogleMaps();
    });
  }
}

/**
 * T185: Handle route optimization
 */
async function handleOptimizeRoute() {
  if (!currentTrip) return;

  try {
    // Show loading state
    const optimizeBtn = document.querySelector('[data-action="optimize-route"]');
    const originalContent = optimizeBtn?.innerHTML;
    if (optimizeBtn) {
      optimizeBtn.disabled = true;
      optimizeBtn.innerHTML = `<span>⏳</span> ${t('map.optimizing')}`;
    }

    // Call backend optimize route API
    const token = getItem('auth_token');
    const response = await fetch(`/api/v1/trips/${currentTrip.id}/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Failed to optimize route');
    }

    const data = await response.json();

    // Show success message with summary
    const { totalDistance, totalTravelTime } = data;
    const hours = Math.floor(totalTravelTime / 60);
    const minutes = totalTravelTime % 60;

    showToast(
      t('map.routeOptimized', { distance: totalDistance, hours, minutes }),
      'success'
    );

    // Show distance info on map
    if (mapInstance) {
      mapInstance.showDistanceInfo(totalDistance, totalTravelTime);
    }

    // Note: We're not updating activity order automatically
    // The user can choose to manually reorder if they want
    // This prevents unexpected changes to their itinerary

    // Restore button state
    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.innerHTML = originalContent;
    }
  } catch (error) {
    console.error('Failed to optimize route:', error);
    showToast(t('map.optimizeFailed'), 'error');

    // Reset button state
    const optimizeBtn = document.querySelector('[data-action="optimize-route"]');
    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.innerHTML = `<span>🗺️</span> ${t('map.optimizeRoute')}`;
    }
  }
}

/**
 * T186: Handle export to Google Maps
 */
function handleExportToGoogleMaps() {
  if (!currentActivities || currentActivities.length === 0) {
    showToast(t('map.noActivities'), 'warning');
    return;
  }

  const url = generateGoogleMapsUrl(currentActivities);

  if (!url) {
    showToast(t('map.noLocations'), 'warning');
    return;
  }

  // Open Google Maps in a new tab
  window.open(url, '_blank');
  showToast(t('map.openingGoogleMaps'), 'success');
}

/**
 * T188: Update map when activities change
 */
function updateMap() {
  if (mapInstance) {
    mapInstance.updateActivities(currentActivities);
  }
}
