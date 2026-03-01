// Timeline refresh hub — re-renders the unified timeline and reattaches listeners.
// Reads ctx.handlers (populated by index.js) to avoid circular imports.

import { ctx } from './state.js';
import { updateMap } from './map-handlers.js';
import {
  createUnifiedTimeline,
  attachUnifiedTimelineListeners,
} from '../../components/unified-timeline.js';
import {
  initializeDragDrop,
  destroyDragDrop,
} from '../../components/drag-drop.js';
import { attachTimelineFilterListeners } from '../../components/timeline-filter.js';
import { authState } from '../../state/auth-state.js';
import { tripState } from '../../state/trip-state.js';
import { suggestionState } from '../../state/suggestion-state.js';
import { logError } from '../../utils/error-tracking.js';

// Listen for auto route calculation completion to update the map with newly
// calculated route data and sync any deferred WebSocket activity updates.
document.addEventListener('auto-routes-complete', () => {
  updateMap();
});

/**
 * Refresh the timeline UI with current activities and suggestions
 */
export function refreshTimeline() {
  const mainContent = document.querySelector('.trip-timeline-scroll');

  if (mainContent && ctx.currentTrip) {
    // Deduplicate currentActivities by ID (protection against race conditions)
    const seenIds = new Set();
    ctx.currentActivities = ctx.currentActivities.filter((a) => {
      if (seenIds.has(a.id)) {
        return false;
      }
      seenIds.add(a.id);
      return true;
    });

    const currentUser = authState.getCurrentUser();
    const isOwner = ctx.currentTrip.ownerId === currentUser?.id;
    const userRole = ctx.currentTrip.userRole || (isOwner ? 'owner' : 'viewer');

    const timelineHtml = createUnifiedTimeline(
      ctx.currentActivities,
      ctx.currentSuggestions,
      ctx.currentTrip,
      {
        currentUserId: currentUser?.id,
        userRole,
      }
    );

    mainContent.innerHTML = timelineHtml;

    // Reattach unified timeline listeners using handler references from ctx
    const timelineContainer = mainContent.querySelector('.unified-timeline');
    if (timelineContainer) {
      attachUnifiedTimelineListeners(timelineContainer, {
        onAddActivity: ctx.handlers.handleAddActivity,
        onAddSuggestion: ctx.handlers.handleAddSuggestion,
        onEditActivity: ctx.handlers.handleEditActivity,
        onDeleteActivity: ctx.handlers.handleDeleteActivity,
        onSaveActivity: ctx.handlers.handleSaveActivityField,
        onDeleteReservation: ctx.handlers.handleDeleteReservation,
        onSaveReservation: ctx.handlers.handleSaveReservationField,
        onReservationTypeChange: ctx.handlers.handleReservationTypeChange,
        onVoteSuggestion: ctx.handlers.handleVoteSuggestion,
        onAcceptSuggestion: ctx.handlers.handleAcceptSuggestion,
        onRejectSuggestion: ctx.handlers.handleRejectSuggestion,
        onTransportChange: ctx.handlers.handleTransportChange,
        onActivityClick: ctx.handlers.handleActivityClick,
      });

      // Reinitialize drag and drop
      if (ctx.sortableInstances.length > 0) {
        destroyDragDrop(ctx.sortableInstances);
        ctx.sortableInstances = [];
      }
      ctx.sortableInstances = initializeDragDrop(
        timelineContainer,
        ctx.handlers.handleReorder,
        ctx.handlers.handleActivityDateChange
      );

      // Re-attach timeline filter and restore state
      const savedFilterState = ctx.timelineFilter?.getFilterState();
      if (ctx.timelineFilter) {
        ctx.timelineFilter.cleanup();
      }
      const filterBar = timelineContainer.querySelector('.timeline-filter-bar');
      if (filterBar) {
        const filterApi = attachTimelineFilterListeners(filterBar, timelineContainer);
        ctx.timelineFilter = filterApi;
        if (savedFilterState) {
          filterApi.setFilterState(savedFilterState);
        }
      }
    }

    // Re-initialize date sidebar observer (day elements were recreated)
    if (ctx.dateSidebarCleanup && ctx.dateSidebarCleanup.reinit) {
      ctx.dateSidebarCleanup.reinit();
    }

    updateMap();
  }
}

/**
 * Refresh activities list from API
 */
export async function refreshActivities() {
  try {
    const activities = await tripState.loadActivities(ctx.currentTrip.id);
    ctx.currentActivities = activities;
    refreshTimeline();
  } catch (error) {
    logError('Failed to refresh activities:', error);
  }
}

/**
 * Refresh suggestions list from API
 */
export async function refreshSuggestions() {
  try {
    const suggestions = await suggestionState.loadSuggestions(
      ctx.currentTrip.id
    );
    ctx.currentSuggestions = suggestions;
    refreshTimeline();
  } catch (error) {
    logError('Failed to refresh suggestions:', error);
  }
}

/**
 * Update suggestions in the unified timeline
 */
export function updateSuggestionList() {
  refreshTimeline();
}
