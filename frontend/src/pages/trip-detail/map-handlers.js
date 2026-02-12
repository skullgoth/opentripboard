// Map initialization, controls, route optimization, and Google Maps export.

import { ctx } from './state.js';
import { initializeMap, generateGoogleMapsUrl } from '../../components/map-view.js';
import { showToast } from '../../utils/toast.js';
import { getItem } from '../../utils/storage.js';
import { t } from '../../utils/i18n.js';

/**
 * Initialize map view with activities.
 * Always shows map — world view when no activities with coordinates.
 * @param {Array} activities - Activities with coordinates
 */
export async function initializeMapView(activities) {
  if (ctx.mapInstance) {
    ctx.mapInstance.destroy();
    ctx.mapInstance = null;
  }

  const sortedActivities = sortActivitiesForRoute(activities);

  try {
    ctx.mapInstance = await initializeMap('trip-map', sortedActivities, {
      onMarkerClick: (activity) => {
        scrollToAndExpandCard(activity.id);
      },
      showRoute: true,
    });
  } catch (error) {
    console.error('Failed to initialize map:', error);
    showToast(t('map.loadFailed'), 'error');
  }
}

/**
 * Scroll to and expand an activity card by ID
 * @param {string} activityId - The activity ID
 */
export function scrollToAndExpandCard(activityId) {
  const container = document.getElementById('page-container');
  if (!container) return;

  const card = container.querySelector(
    `.activity-card[data-activity-id="${activityId}"]`
  );

  if (!card) {
    console.warn(`Card not found for activity ID: ${activityId}`);
    return;
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    if (card.classList.contains('expanded')) {
      card.classList.add('highlight');
      setTimeout(() => card.classList.remove('highlight'), 1000);
      return;
    }

    const header = card.querySelector('.activity-card-header');
    if (header) {
      header.click();
    }

    card.classList.add('highlight');
    setTimeout(() => card.classList.remove('highlight'), 1000);
  }, 300);
}

/**
 * Zoom map to activity when timeline card is clicked
 * @param {string} activityId - The activity ID
 */
export function handleActivityClick(activityId) {
  if (ctx.mapInstance) {
    ctx.mapInstance.zoomToActivity(activityId);
  }
}

/**
 * Attach map control event listeners
 */
export function attachMapListeners() {
  const container = document.getElementById('page-container');

  const fitBoundsBtn = container.querySelector('[data-action="fit-bounds"]');
  if (fitBoundsBtn) {
    fitBoundsBtn.addEventListener('click', () => {
      if (ctx.mapInstance) {
        ctx.mapInstance.fitBounds();
      }
    });
  }

  const toggleRouteBtn = container.querySelector('[data-action="toggle-route"]');
  if (toggleRouteBtn) {
    toggleRouteBtn.addEventListener('click', () => {
      if (ctx.mapInstance) {
        ctx.mapInstance.toggleRoute();
      }
    });
  }

  const toggleDistanceBtn = container.querySelector(
    '[data-action="toggle-distance-mode"]'
  );
  if (toggleDistanceBtn) {
    toggleDistanceBtn.addEventListener('click', () => {
      if (ctx.mapInstance) {
        ctx.mapInstance.toggleDistanceMode();
      }
    });
  }

  const optimizeBtn = container.querySelector('[data-action="optimize-route"]');
  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', async () => {
      await handleOptimizeRoute();
    });
  }

  const exportBtn = container.querySelector(
    '[data-action="export-google-maps"]'
  );
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      handleExportToGoogleMaps();
    });
  }
}

/**
 * Handle route optimization
 */
export async function handleOptimizeRoute() {
  if (!ctx.currentTrip) return;

  try {
    const optimizeBtn = document.querySelector(
      '[data-action="optimize-route"]'
    );
    const originalContent = optimizeBtn?.innerHTML;
    if (optimizeBtn) {
      optimizeBtn.disabled = true;
      optimizeBtn.innerHTML = `<span>⏳</span> ${t('map.optimizing')}`;
    }

    const token = getItem('auth_token');
    const response = await fetch(
      `/api/v1/trips/${ctx.currentTrip.id}/optimize-route`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to optimize route');
    }

    const data = await response.json();

    const { totalDistance, totalTravelTime } = data;
    const hours = Math.floor(totalTravelTime / 60);
    const minutes = totalTravelTime % 60;

    showToast(
      t('map.routeOptimized', { distance: totalDistance, hours, minutes }),
      'success'
    );

    if (ctx.mapInstance) {
      ctx.mapInstance.showDistanceInfo(totalDistance, totalTravelTime);
    }

    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.innerHTML = originalContent;
    }
  } catch (error) {
    console.error('Failed to optimize route:', error);
    showToast(t('map.optimizeFailed'), 'error');

    const optimizeBtn = document.querySelector(
      '[data-action="optimize-route"]'
    );
    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.innerHTML = `<span>🗺️</span> ${t('map.optimizeRoute')}`;
    }
  }
}

/**
 * Handle export to Google Maps (map panel button)
 */
export function handleExportToGoogleMaps() {
  if (!ctx.currentActivities || ctx.currentActivities.length === 0) {
    showToast(t('map.noActivities'), 'warning');
    return;
  }

  const url = generateGoogleMapsUrl(ctx.currentActivities);

  if (!url) {
    showToast(t('map.noLocations'), 'warning');
    return;
  }

  window.open(url, '_blank');
  showToast(t('map.openingGoogleMaps'), 'success');
}

/**
 * Sort activities for map route display.
 * Order: by date (startTime), then by orderIndex within the same day, undated last.
 * @param {Array} activities - Activities to sort
 * @returns {Array} Sorted activities
 */
export function sortActivitiesForRoute(activities) {
  return [...activities].sort((a, b) => {
    if (!a.startTime && b.startTime) return 1;
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && !b.startTime) {
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    }

    const dateA = a.startTime.split('T')[0];
    const dateB = b.startTime.split('T')[0];
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    if ((a.orderIndex || 0) !== (b.orderIndex || 0)) {
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    }
    return new Date(a.startTime) - new Date(b.startTime);
  });
}

/**
 * Update map when activities change
 */
export function updateMap() {
  if (ctx.mapInstance) {
    const sortedActivities = sortActivitiesForRoute(ctx.currentActivities);
    ctx.mapInstance.updateActivities(sortedActivities);
  }
}
