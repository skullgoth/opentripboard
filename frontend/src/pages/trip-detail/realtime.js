// All WebSocket subscriptions and real-time event handlers.

import { ctx } from './state.js';
import {
  refreshTimeline,
  refreshActivities,
  updateSuggestionList,
} from './timeline.js';
import { wsClient } from '../../services/websocket-client.js';
import { realtimeManager } from '../../services/realtime-updates.js';
import { isAutoCalculatingRoutes } from '../../components/unified-timeline.js';
import { logError } from '../../utils/error-tracking.js';

/**
 * Join trip room for real-time updates
 * @param {string} tripId - Trip ID
 */
export function joinTripRoom(tripId) {
  if (wsClient.isConnected && wsClient.isAuthenticated) {
    wsClient.joinTrip(tripId);
  } else {
    wsClient
      .connect()
      .then(() => wsClient.joinTrip(tripId))
      .catch((error) => {
        logError('Failed to join trip room:', error);
      });
  }
}

/**
 * Subscribe to presence updates
 */
export function subscribeToPresenceUpdates() {
  realtimeManager.init();

  ctx.presenceUnsubscribe = realtimeManager.onPresenceUpdate(
    (presenceData) => {
      ctx.activeUsers = presenceData.activeUsers || [];
      updatePresenceIndicator();
    }
  );

  wsClient.on('room:joined', (message) => {
    if (message.activeUsers) {
      ctx.activeUsers = message.activeUsers;
      updatePresenceIndicator();
    }
  });
}

/**
 * Update presence indicator in the UI
 */
export function updatePresenceIndicator() {
  // Update presence indicators on existing badges (sidebar)
  const tripBuddyItems = document.querySelectorAll(
    '.trip-buddy-item-compact'
  );

  tripBuddyItems.forEach((item) => {
    const userId = item.getAttribute('data-user-id');
    const badge = item.querySelector('.trip-buddy-avatar-badge');

    if (!badge) {
      return;
    }

    const existingIndicator = badge.querySelector('.presence-indicator');
    const isActive = ctx.activeUsers.includes(userId);

    if (isActive && !existingIndicator) {
      badge.classList.add('is-active');
      const indicator = document.createElement('span');
      indicator.className = 'presence-indicator';
      badge.appendChild(indicator);
    } else if (!isActive && existingIndicator) {
      badge.classList.remove('is-active');
      existingIndicator.remove();
    }
  });

  // Update presence indicators in overlay compact list
  const compactAvatars = document.querySelectorAll(
    '.trip-buddies-inline .trip-buddy-avatar[data-user-id]'
  );

  compactAvatars.forEach((avatar) => {
    const userId = avatar.getAttribute('data-user-id');
    const existingIndicator = avatar.querySelector('.presence-indicator');

    if (!userId || userId === 'undefined') {
      return;
    }

    const isActive = ctx.activeUsers.map(String).includes(String(userId));

    if (isActive && !existingIndicator) {
      avatar.classList.add('is-active');
      const indicator = document.createElement('span');
      indicator.className = 'presence-indicator';
      avatar.appendChild(indicator);
    } else if (!isActive && existingIndicator) {
      avatar.classList.remove('is-active');
      existingIndicator.remove();
    }
  });
}

// --- Activity real-time events ---

/**
 * Subscribe to activity updates from WebSocket
 */
export function subscribeToActivityUpdates() {
  ctx.activityUnsubscribe = realtimeManager.onActivityUpdate((event) => {
    if (event.type === 'created') {
      handleActivityCreatedEvent(event);
    } else if (event.type === 'updated') {
      handleActivityUpdatedEvent(event);
    } else if (event.type === 'deleted') {
      handleActivityDeletedEvent(event);
    } else if (event.type === 'reordered') {
      handleActivityReorderedEvent(event);
    }
  });
}

function handleActivityCreatedEvent(event) {
  if (ctx.pendingActivityIds.has(event.activity?.id)) {
    return;
  }

  if (
    !event.activity ||
    ctx.currentActivities.find((a) => a.id === event.activity.id)
  ) {
    return;
  }

  ctx.currentActivities.push(event.activity);
  refreshTimeline();
}

function handleActivityUpdatedEvent(event) {
  const index = ctx.currentActivities.findIndex(
    (a) => a.id === event.activityId
  );
  if (index !== -1 && event.activity) {
    ctx.currentActivities[index] = event.activity;
    // Defer timeline refresh while auto route calculation is in progress
    // to prevent DOM invalidation mid-batch. The final refresh happens
    // after auto-calculation completes.
    if (!isAutoCalculatingRoutes()) {
      refreshTimeline();
    }
  }
}

function handleActivityDeletedEvent(event) {
  ctx.currentActivities = ctx.currentActivities.filter(
    (a) => a.id !== event.activityId
  );
  refreshTimeline();
}

function handleActivityReorderedEvent(event) {
  if (event.activities && Array.isArray(event.activities)) {
    const orderMap = new Map();
    event.activities.forEach((a, index) => {
      orderMap.set(a.id, a.orderIndex !== undefined ? a.orderIndex : index);
    });

    ctx.currentActivities.forEach((activity) => {
      if (orderMap.has(activity.id)) {
        activity.orderIndex = orderMap.get(activity.id);
      }
    });

    refreshTimeline();
  }
}

// --- Suggestion real-time events ---

/**
 * Subscribe to suggestion updates from WebSocket
 */
export function subscribeToSuggestionUpdates() {
  ctx.suggestionUnsubscribe = realtimeManager.onSuggestionUpdate((event) => {
    if (event.type === 'created') {
      handleSuggestionCreatedEvent(event);
    } else if (event.type === 'voted') {
      handleSuggestionVotedEvent(event);
    } else if (event.type === 'accepted' || event.type === 'rejected') {
      handleSuggestionStatusChangedEvent(event);
    } else if (event.type === 'updated') {
      handleSuggestionUpdatedEvent(event);
    } else if (event.type === 'deleted') {
      handleSuggestionDeletedEvent(event);
    }
  });
}

function handleSuggestionCreatedEvent(event) {
  if (
    event.suggestion &&
    !ctx.currentSuggestions.find((s) => s.id === event.suggestion.id)
  ) {
    ctx.currentSuggestions.push(event.suggestion);
    updateSuggestionList();
  }
}

function handleSuggestionVotedEvent(event) {
  const index = ctx.currentSuggestions.findIndex(
    (s) => s.id === event.suggestionId
  );
  if (index !== -1 && event.suggestion) {
    ctx.currentSuggestions[index] = event.suggestion;
    updateSuggestionList();
  }
}

function handleSuggestionStatusChangedEvent(event) {
  const index = ctx.currentSuggestions.findIndex(
    (s) => s.id === event.suggestionId
  );
  if (index !== -1 && event.suggestion) {
    ctx.currentSuggestions[index] = event.suggestion;
    updateSuggestionList();

    if (event.type === 'accepted') {
      refreshActivities();
    }
  }
}

function handleSuggestionUpdatedEvent(event) {
  const index = ctx.currentSuggestions.findIndex(
    (s) => s.id === event.suggestionId
  );
  if (index !== -1 && event.suggestion) {
    ctx.currentSuggestions[index] = event.suggestion;
    updateSuggestionList();
  }
}

function handleSuggestionDeletedEvent(event) {
  ctx.currentSuggestions = ctx.currentSuggestions.filter(
    (s) => s.id !== event.suggestionId
  );
  updateSuggestionList();
}
