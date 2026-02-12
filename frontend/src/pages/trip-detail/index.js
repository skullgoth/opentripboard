// T077: TripDetail page - display itinerary timeline and manage activities
// T187-T189: Map view integration with activities
// US4: Unified timeline with all item types
// US9: Export and sharing functionality
//
// Orchestrator: loads data, renders the page, wires sub-modules together.

import { ctx, resetState } from './state.js';
import { getCoverImageUrl, renderCoverImageAttribution, escapeHtml } from './helpers.js';
import { initializeMapView, attachMapListeners, handleActivityClick } from './map-handlers.js';
import { refreshTimeline } from './timeline.js';
import {
  handleAddActivity,
  handleEditActivity,
  handleDeleteActivity,
  handleSaveActivityField,
  handleTransportChange,
} from './activity-handlers.js';
import {
  handleAddReservation,
  handleSaveReservationField,
  handleReservationTypeChange,
  handleDeleteReservation,
  handleReorder,
  handleActivityDateChange,
} from './reservation-handlers.js';
import {
  joinTripRoom,
  subscribeToPresenceUpdates,
  subscribeToActivityUpdates,
  subscribeToSuggestionUpdates,
} from './realtime.js';
import {
  handleAddSuggestion,
  handleVoteSuggestion,
  handleAcceptSuggestion,
  handleRejectSuggestion,
} from './suggestion-handlers.js';
import {
  showTripModal,
  handleDeleteTrip,
  handleEditCoverImage,
  handleCoverImageUpload,
  handleDeleteCoverImage,
  handleExportGoogleMaps,
  attachTripBuddyListeners,
} from './trip-management.js';

import {
  createUnifiedTimeline,
  attachUnifiedTimelineListeners,
} from '../../components/unified-timeline.js';
import {
  initializeDragDrop,
  destroyDragDrop,
  addDragDropStyles,
} from '../../components/drag-drop.js';
import { createMapView } from '../../components/map-view.js';
import {
  createTripBuddyList,
  createCompactTripBuddyList,
} from '../../components/trip-buddy-list.js';
import { showShareDialog } from '../../components/share-dialog.js';
import { showExportModal } from '../../components/export-modal.js';
import { wsClient } from '../../services/websocket-client.js';
import { app } from '../../main.js';
import { tripState } from '../../state/trip-state.js';
import { suggestionState } from '../../state/suggestion-state.js';
import { tripBuddyState } from '../../state/trip-buddy-state.js';
import { authState } from '../../state/auth-state.js';
import { formatDate } from '../../utils/date-helpers.js';
import { t } from '../../utils/i18n.js';

/**
 * Render trip detail page
 * @param {Object} params - Route parameters
 */
export async function tripDetailPage(params) {
  const container = document.getElementById('page-container');
  const { id: tripId } = params;

  // Register reloadPage helper so sub-modules can reload without importing us
  ctx.reloadPage = (id) => tripDetailPage({ id });

  // Check authentication
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>${t('trip.loading')}</p>
    </div>
  `;

  try {
    // Load trip, activities, suggestions, and tripBuddies from API
    const [trip, activities, suggestions, tripBuddies] = await Promise.all([
      tripState.loadTrip(tripId),
      tripState.loadActivities(tripId),
      suggestionState.loadSuggestions(tripId),
      tripBuddyState.loadTripBuddies(tripId),
    ]);

    ctx.currentTrip = trip;
    ctx.currentActivities = activities;
    ctx.currentSuggestions = suggestions;
    ctx.currentTripBuddies = tripBuddies;

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
      ctx.activeUsers
    );

    // Render compact buddy list for overlay
    const tripBuddyCompactHtml = createCompactTripBuddyList(
      tripBuddies,
      currentUser?.id,
      isOwner,
      ctx.activeUsers
    );

    // Format dates for display
    const dateRange =
      trip.startDate && trip.endDate
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

    // Render unified timeline
    const userRole = trip.userRole || (isOwner ? 'owner' : 'viewer');
    const timelineHtml = createUnifiedTimeline(
      activities,
      suggestions,
      trip,
      {
        currentUserId: currentUser?.id,
        userRole,
      }
    );

    // Render map view HTML
    const mapViewHtml = await createMapView(ctx.currentActivities, {
      containerId: 'trip-map',
      showControls: true,
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
              ${timelineHtml}
            </div>
          </div>
          <div class="trip-map-section">
            ${mapViewHtml}
          </div>
        </div>
      </div>
    `;

    // --- Register all handler references in ctx for timeline.js ---
    ctx.handlers = {
      handleAddActivity,
      handleAddSuggestion,
      handleEditActivity,
      handleDeleteActivity,
      handleSaveActivityField,
      handleDeleteReservation,
      handleSaveReservationField,
      handleReservationTypeChange,
      handleVoteSuggestion,
      handleAcceptSuggestion,
      handleRejectSuggestion,
      handleTransportChange,
      handleActivityClick,
      handleReorder,
      handleActivityDateChange,
    };

    // Attach unified timeline listeners
    const timelineContainer = container.querySelector('.unified-timeline');
    if (timelineContainer) {
      attachUnifiedTimelineListeners(timelineContainer, {
        onAddActivity: handleAddActivity,
        onAddSuggestion: handleAddSuggestion,
        onEditActivity: handleEditActivity,
        onDeleteActivity: handleDeleteActivity,
        onSaveActivity: handleSaveActivityField,
        onDeleteReservation: handleDeleteReservation,
        onSaveReservation: handleSaveReservationField,
        onReservationTypeChange: handleReservationTypeChange,
        onVoteSuggestion: handleVoteSuggestion,
        onAcceptSuggestion: handleAcceptSuggestion,
        onRejectSuggestion: handleRejectSuggestion,
        onTransportChange: handleTransportChange,
        onActivityClick: handleActivityClick,
      });
    }

    // Initialize drag-and-drop for unified timeline
    if (timelineContainer) {
      if (!document.getElementById('drag-drop-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'drag-drop-styles';
        addDragDropStyles();
      }

      ctx.sortableInstances = initializeDragDrop(
        timelineContainer,
        handleReorder,
        handleActivityDateChange
      );
    }

    // Attach trip buddy listeners
    attachTripBuddyListeners();

    // Initialize map and attach map listeners
    await initializeMapView(activities);
    attachMapListeners();

    // Attach edit trip button
    container
      .querySelector('[data-action="edit-trip"]')
      ?.addEventListener('click', () => {
        showTripModal(trip);
      });

    // Attach delete trip button
    container
      .querySelector('[data-action="delete-trip"]')
      ?.addEventListener('click', () => {
        handleDeleteTrip(trip);
      });

    // Attach export trip button (opens modal)
    container
      .querySelector('[data-action="export-trip"]')
      ?.addEventListener('click', () => {
        showExportModal(trip);
      });

    // Attach export to Google Maps button
    container
      .querySelector('[data-action="export-google-maps"]')
      ?.addEventListener('click', () => {
        handleExportGoogleMaps();
      });

    // Attach share trip button
    container
      .querySelector('[data-action="share-trip"]')
      ?.addEventListener('click', () => {
        showShareDialog(trip.id);
      });

    // Attach cover image edit button
    container
      .querySelector('[data-action="edit-cover-image"]')
      ?.addEventListener('click', () => {
        handleEditCoverImage();
      });

    // Attach cover image delete button
    container
      .querySelector('[data-action="delete-cover-image"]')
      ?.addEventListener('click', () => {
        handleDeleteCoverImage();
      });

    // Attach trip menu toggle
    const tripMenuTrigger = container.querySelector(
      '[data-action="toggle-trip-menu"]'
    );
    const tripMenuDropdown = container.querySelector('.trip-menu-dropdown');

    if (tripMenuTrigger && tripMenuDropdown) {
      tripMenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = tripMenuDropdown.style.display === 'block';
        tripMenuDropdown.style.display = isVisible ? 'none' : 'block';
      });

      document.addEventListener('click', () => {
        tripMenuDropdown.style.display = 'none';
      });

      tripMenuDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Handle cover image file input change
    const coverImageInput = container.querySelector('#cover-image-input');
    if (coverImageInput) {
      const newInput = coverImageInput.cloneNode(true);
      coverImageInput.parentNode.replaceChild(newInput, coverImageInput);

      newInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await handleCoverImageUpload(file);
        }
        e.target.value = '';
      });
    }

    // Wire presence and real-time updates
    joinTripRoom(tripId);
    subscribeToPresenceUpdates();
    subscribeToSuggestionUpdates();
    subscribeToActivityUpdates();
  } catch (error) {
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
  if (ctx.sortableInstances.length > 0) {
    destroyDragDrop(ctx.sortableInstances);
    ctx.sortableInstances = [];
  }

  if (ctx.mapInstance) {
    ctx.mapInstance.destroy();
    ctx.mapInstance = null;
  }

  if (ctx.presenceUnsubscribe) {
    ctx.presenceUnsubscribe();
    ctx.presenceUnsubscribe = null;
  }

  if (ctx.suggestionUnsubscribe) {
    ctx.suggestionUnsubscribe();
    ctx.suggestionUnsubscribe = null;
  }

  if (ctx.activityUnsubscribe) {
    ctx.activityUnsubscribe();
    ctx.activityUnsubscribe = null;
  }

  if (ctx.tripBuddyUnsubscribe) {
    ctx.tripBuddyUnsubscribe();
    ctx.tripBuddyUnsubscribe = null;
  }
  tripBuddyState.clear();

  if (ctx.currentTrip) {
    wsClient.leaveTrip(ctx.currentTrip.id);
  }

  resetState();
}
