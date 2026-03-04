// T179-T184, T187: Map view component using Leaflet
// T181: Marker clustering for large numbers of activities
// Displays activity locations on an interactive map with markers and routes
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';
import { logError, logWarning } from '../utils/error-tracking.js';

/**
 * Type-to-icon mapping for all activity and reservation types
 */
const TYPE_ICONS = {
  // Lodging/Accommodation
  hotel: '🏨',
  rental: '🏠',
  accommodation: '🏨',
  // Transport
  bus: '🚌',
  car: '🚗',
  cruise: '🚢',
  ferry: '⛴️',
  flight: '✈️',
  train: '🚆',
  transportation: '🚗',
  // Dining
  bar: '🍸',
  restaurant: '🍽️',
  // Activities
  market: '🛒',
  monument: '🗽',
  museum: '🏛️',
  park: '🌳',
  shopping: '🛍️',
  sightseeing: '📸',
  attraction: '🎭',
  meeting: '👥',
  event: '🎉',
  // Default
  other: '📍',
};

/**
 * Get icon for activity/reservation type
 * @param {string} type - Activity or reservation type
 * @returns {string} Emoji icon
 */
function getTypeIcon(type) {
  return TYPE_ICONS[type] || TYPE_ICONS.other;
}

let leafletLoaded = false;
let markerClusterLoaded = false;
let polylineDecoratorLoaded = false;
let L = null;

/**
 * Day color palette for route segments (distinct, works on light/dark tiles)
 */
const DAY_COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#42d4f4', // cyan
  '#f032e6', // magenta
  '#bfef45', // lime
  '#fabed4', // pink
  '#469990', // teal
];

/**
 * Lazy-load Leaflet library and marker clustering plugin
 * @returns {Promise<object>} Leaflet object
 */
async function loadLeaflet() {
  if (leafletLoaded && L) {
    return L;
  }

  // Dynamically import Leaflet
  const leafletModule = await import('leaflet');
  L = leafletModule.default;
  leafletLoaded = true;

  // Load marker cluster plugin
  if (!markerClusterLoaded) {
    try {
      await import('leaflet.markercluster');
      markerClusterLoaded = true;
    } catch (error) {
      logWarning('Failed to load marker clustering plugin:', error);
    }
  }

  // Load polyline decorator plugin
  if (!polylineDecoratorLoaded) {
    try {
      await import('leaflet-polylinedecorator');
      polylineDecoratorLoaded = true;
    } catch (error) {
      logWarning('Failed to load polyline decorator plugin:', error);
    }
  }

  return L;
}

/**
 * Create map view component
 * @param {Array} activities - Array of activities with coordinates
 * @param {Object} options - Map configuration options
 * @returns {Promise<string>} HTML for map container
 */
export async function createMapView(activities = [], options = {}) {
  const {
    containerId = 'trip-map',
    height = '100%',
    showControls = true
  } = options;

  return `
    <div class="map-container" style="height: ${height};">
      <div id="${containerId}" class="map-canvas" style="height: 100%; width: 100%;"></div>
      <div class="map-route-loading" id="map-route-loading" style="display: none;">
        <div class="map-route-loading__spinner"></div>
        <span class="map-route-loading__text">${t('map.routeCalculating')}</span>
      </div>
      ${showControls ? `
        <div class="map-controls">
          <button class="btn btn-secondary btn-sm" data-action="fit-bounds" title="${t('map.fitBounds')}">
            <span>🎯</span> ${t('map.fitView')}
          </button>
          <button class="btn btn-secondary btn-sm" data-action="toggle-route" title="${t('map.toggleRoute')}">
            <span id="route-toggle-icon">👁️</span> ${t('map.route')}
          </button>
          <button class="btn btn-secondary btn-sm" data-action="toggle-distance-mode" title="${t('map.toggleDistance')}">
            <span id="distance-mode-icon">📏</span> ${t('map.distance')}
          </button>
          <button class="btn btn-primary btn-sm" data-action="optimize-route" title="${t('map.optimizeRoute')}">
            <span>🗺️</span> ${t('map.optimizeRoute')}
          </button>
        </div>
        <div class="map-info" id="map-info" style="display: none;">
          <div class="map-info-content"></div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Initialize map with activities
 * @param {string} containerId - ID of map container element
 * @param {Array} activities - Activities to display on map
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Map instance and utilities
 */
export async function initializeMap(containerId, activities = [], options = {}) {
  const {
    center = [0, 0],
    zoom = 2,
    onMarkerClick = null,
    showRoute = true
  } = options;

  // Load Leaflet library
  await loadLeaflet();

  const container = document.getElementById(containerId);
  if (!container) {
    logError(`Map container #${containerId} not found`);
    return null;
  }

  // Create map instance with world wrapping and bounds
  const map = L.map(containerId, {
    worldCopyJump: true, // Seamless horizontal panning across the antimeridian
    maxBounds: [[-90, -Infinity], [90, Infinity]], // Restrict vertical panning to valid latitudes
    maxBoundsViscosity: 1.0, // Hard stop at bounds (no elastic effect)
    minZoom: 2, // Prevent zooming out too far
  }).setView(center, zoom);

  // Add OpenStreetMap tiles with wrapping enabled
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    noWrap: false // Allow tiles to wrap horizontally
  }).addTo(map);

  // Track markers and route
  const markers = [];
  let markerClusterGroup = null;
  let routePolyline = null;
  let routeVisible = showRoute;
  const USE_CLUSTERING_THRESHOLD = 20; // T181: Use clustering for 20+ markers

  // T183: Distance measurement state
  let distanceLabelsVisible = false;
  let distanceLabels = []; // Array of L.divIcon markers for distance labels

  /**
   * Create custom marker icon with emoji based on activity type
   * @param {string} type - Activity or reservation type
   * @returns {L.DivIcon} Custom Leaflet divIcon
   */
  function createMarkerIcon(type) {
    const icon = getTypeIcon(type);
    return L.divIcon({
      className: 'map-marker-icon',
      html: `<div class="map-marker-emoji">${icon}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }

  /**
   * T181: Add activity markers to map with optional clustering
   */
  function addMarkers(activitiesToAdd) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers.length = 0;

    // Clear existing cluster group if any
    if (markerClusterGroup) {
      map.removeLayer(markerClusterGroup);
      markerClusterGroup = null;
    }

    // Filter activities with valid coordinates
    const validActivities = activitiesToAdd.filter(
      activity => activity.latitude && activity.longitude
    );

    if (validActivities.length === 0) {
      logWarning('No activities with coordinates to display on map');
      return;
    }

    // Use clustering for 20+ markers
    const useClustering = validActivities.length >= USE_CLUSTERING_THRESHOLD && L.markerClusterGroup;

    if (useClustering) {
      // Create marker cluster group
      markerClusterGroup = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 60
      });
    }

    // Add marker for each activity
    validActivities.forEach((activity, index) => {
      const customIcon = createMarkerIcon(activity.type);
      const marker = L.marker([activity.latitude, activity.longitude], { icon: customIcon });
      marker.activityData = activity; // Store activity data on marker

      // Create popup content with activity details
      const typeIcon = getTypeIcon(activity.type);
      const popupContent = `
        <div class="map-popup">
          <h4><span class="map-popup-icon">${typeIcon}</span> ${escapeHtml(activity.title)}</h4>
          ${activity.location ? `<p class="map-popup-location">📍 ${escapeHtml(activity.location)}</p>` : ''}
          ${activity.startTime ? `<p class="map-popup-time">🕒 ${formatDateTime(activity.startTime)}</p>` : ''}
          ${activity.notes ? `<p class="map-popup-notes">${escapeHtml(activity.notes)}</p>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      // Handle marker click
      marker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(activity);
        }
      });

      if (useClustering) {
        // Add to cluster group
        markerClusterGroup.addLayer(marker);
      } else {
        // Add directly to map
        marker.addTo(map);
      }

      markers.push(marker);
    });

    // Add cluster group to map if using clustering
    if (useClustering && markerClusterGroup) {
      map.addLayer(markerClusterGroup);
    }

    // Fit map bounds to show all markers
    if (validActivities.length > 0) {
      const bounds = L.latLngBounds(
        validActivities.map(a => [a.latitude, a.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Draw route if enabled
    if (routeVisible) {
      drawRoute(validActivities);
    }
  }

  // Track route polylines and arrow decorators
  let transportPolylines = [];
  let arrowDecorators = [];
  let dayLegendControl = null;

  /**
   * Get date string from an activity's startTime (local date portion)
   * @param {Object} activity - Activity with startTime
   * @returns {string|null} Date string like "2025-06-15" or null
   */
  function getActivityDateKey(activity) {
    if (!activity.startTime) return null;
    try {
      const d = new Date(activity.startTime);
      // Use local date to match what the user sees
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }

  /**
   * Build segment coordinates from two activities
   */
  function getSegmentCoords(fromActivity, toActivity) {
    const transport = fromActivity.metadata?.transportToNext;

    // Use cached route geometry if available (for road-following routes)
    if (transport?.routeGeometry && Array.isArray(transport.routeGeometry) && transport.routeGeometry.length > 1) {
      return transport.routeGeometry.map(coord => [coord[1], coord[0]]);
    }

    // Straight line between points
    return [
      [fromActivity.latitude, fromActivity.longitude],
      [toActivity.latitude, toActivity.longitude],
    ];
  }

  /**
   * Add arrow decorator to a polyline segment
   */
  function addArrowDecorator(polyline, color) {
    if (!L.polylineDecorator) return;

    const decorator = L.polylineDecorator(polyline, {
      patterns: [{
        offset: '15%',
        repeat: 100,
        symbol: L.Symbol.arrowHead({
          pixelSize: 12,
          polygon: false,
          pathOptions: { stroke: true, color: color, weight: 2, opacity: 0.9 },
        }),
      }],
    });
    decorator.addTo(map);
    arrowDecorators.push(decorator);
  }

  /**
   * Create or update the day color legend on the map
   */
  function updateDayLegend(dayEntries) {
    removeDayLegend();

    if (!dayEntries || dayEntries.length === 0) return;

    const LegendControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'map-day-legend');
        L.DomEvent.disableClickPropagation(container);

        let html = `<div class="map-day-legend__title">${t('map.dayLegend')}</div>`;
        dayEntries.forEach(({ dayIndex, color, dateStr }) => {
          const label = `${t('timeline.day')} ${dayIndex + 1}`;
          const dateLabel = formatDateShort(dateStr);
          html += `<div class="map-day-legend__item">`;
          html += `<span class="map-day-legend__color" style="background:${color}"></span>`;
          html += `<span class="map-day-legend__label">${label}</span>`;
          html += `<span class="map-day-legend__date">${dateLabel}</span>`;
          html += `</div>`;
        });
        container.innerHTML = html;
        return container;
      },
    });

    dayLegendControl = new LegendControl();
    dayLegendControl.addTo(map);
  }

  /**
   * Remove the day legend from map
   */
  function removeDayLegend() {
    if (dayLegendControl) {
      map.removeControl(dayLegendControl);
      dayLegendControl = null;
    }
  }

  /**
   * Format a date string (YYYY-MM-DD) for short display
   */
  function formatDateShort(dateStr) {
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  /**
   * Draw route lines connecting activities, colored by day with directional arrows
   */
  function drawRoute(activitiesToConnect) {
    // Remove existing route polyline (legacy single line)
    if (routePolyline) {
      map.removeLayer(routePolyline);
      routePolyline = null;
    }

    // Remove existing polylines and decorators
    transportPolylines.forEach(pl => map.removeLayer(pl));
    transportPolylines = [];
    arrowDecorators.forEach(d => map.removeLayer(d));
    arrowDecorators = [];

    const validActivities = activitiesToConnect.filter(
      activity => activity.latitude && activity.longitude
    );

    if (validActivities.length < 2) {
      removeDayLegend();
      return;
    }

    // Group activities by day (date key from startTime)
    const dayMap = new Map(); // dateKey -> [activities]
    const undated = [];

    validActivities.forEach(activity => {
      const dateKey = getActivityDateKey(activity);
      if (dateKey) {
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey).push(activity);
      } else {
        undated.push(activity);
      }
    });

    // Sort days chronologically
    const sortedDays = [...dayMap.keys()].sort();

    // Build legend entries
    const legendEntries = [];

    // Draw segments for each day
    sortedDays.forEach((dateKey, dayIndex) => {
      const dayActivities = dayMap.get(dateKey);
      const color = DAY_COLORS[dayIndex % DAY_COLORS.length];

      legendEntries.push({ dayIndex, color, dateStr: dateKey });

      // Draw segments between consecutive activities within the same day
      for (let i = 0; i < dayActivities.length - 1; i++) {
        const segmentCoords = getSegmentCoords(dayActivities[i], dayActivities[i + 1]);
        const polyline = L.polyline(segmentCoords, {
          color,
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1,
        });
        polyline.addTo(map);
        transportPolylines.push(polyline);
        addArrowDecorator(polyline, color);
      }

      // Draw connecting segment from last activity of this day to first of next day
      if (dayIndex < sortedDays.length - 1) {
        const nextDayKey = sortedDays[dayIndex + 1];
        const nextDayActivities = dayMap.get(nextDayKey);
        const lastOfDay = dayActivities[dayActivities.length - 1];
        const firstOfNext = nextDayActivities[0];
        const nextColor = DAY_COLORS[(dayIndex + 1) % DAY_COLORS.length];
        const segmentCoords = getSegmentCoords(lastOfDay, firstOfNext);

        const polyline = L.polyline(segmentCoords, {
          color: nextColor,
          weight: 3,
          opacity: 0.5,
          dashArray: '8, 12',
          smoothFactor: 1,
        });
        polyline.addTo(map);
        transportPolylines.push(polyline);
        addArrowDecorator(polyline, nextColor);
      }
    });

    // Draw undated activities as a single grey chain
    if (undated.length >= 2) {
      for (let i = 0; i < undated.length - 1; i++) {
        const segmentCoords = getSegmentCoords(undated[i], undated[i + 1]);
        const polyline = L.polyline(segmentCoords, {
          color: '#6b7280',
          weight: 2,
          opacity: 0.5,
          dashArray: '3, 6',
          smoothFactor: 1,
        });
        polyline.addTo(map);
        transportPolylines.push(polyline);
        addArrowDecorator(polyline, '#6b7280');
      }
    }

    // Update legend
    updateDayLegend(legendEntries);
  }

  /**
   * Toggle route visibility
   */
  function toggleRoute() {
    routeVisible = !routeVisible;

    if (routeVisible) {
      const validActivities = activities.filter(
        activity => activity.latitude && activity.longitude
      );
      drawRoute(validActivities);
    } else {
      // Remove legacy route polyline
      if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
      }
      // Remove transport polylines
      transportPolylines.forEach(pl => map.removeLayer(pl));
      transportPolylines = [];
      // Remove arrow decorators
      arrowDecorators.forEach(d => map.removeLayer(d));
      arrowDecorators = [];
      // Remove day legend
      removeDayLegend();
    }

    // Update icon
    const icon = document.getElementById('route-toggle-icon');
    if (icon) {
      icon.textContent = routeVisible ? '👁️' : '🙈';
    }

    return routeVisible;
  }

  /**
   * Fit map bounds to show all markers
   */
  function fitBounds() {
    const validActivities = activities.filter(
      activity => activity.latitude && activity.longitude
    );

    if (validActivities.length > 0) {
      const bounds = L.latLngBounds(
        validActivities.map(a => [a.latitude, a.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Zoom to a specific activity and open its popup
   * @param {string} activityId - The activity ID to zoom to
   */
  function zoomToActivity(activityId) {
    const marker = markers.find(m => m.activityData && m.activityData.id === activityId);
    if (!marker) {
      logWarning(`Marker not found for activity ID: ${activityId}`);
      return;
    }

    const activity = marker.activityData;
    if (!activity.latitude || !activity.longitude) {
      logWarning(`Activity ${activityId} has no coordinates`);
      return;
    }

    // Fly to the marker location with a close zoom level
    map.flyTo([activity.latitude, activity.longitude], 16, {
      duration: 0.8
    });

    // Open the popup after the animation completes
    setTimeout(() => {
      marker.openPopup();
    }, 800);
  }

  /**
   * Update map with new activities
   */
  function updateActivities(newActivities) {
    activities = newActivities;
    addMarkers(newActivities);
  }

  /**
   * Show distance info on map
   */
  function showDistanceInfo(distance, travelTime) {
    const infoEl = document.getElementById('map-info');
    if (infoEl) {
      const content = infoEl.querySelector('.map-info-content');
      content.innerHTML = `
        <strong>${t('map.distanceLabel')}</strong> ${distance.toFixed(2)} km<br>
        <strong>${t('map.travelTime')}</strong> ${travelTime} minutes
      `;
      infoEl.style.display = 'block';

      // Auto-hide after 5 seconds
      setTimeout(() => {
        infoEl.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Show distance labels on route segments
   */
  function showDistanceLabels() {
    // Clear existing labels
    hideDistanceLabels();

    // Get valid activities with coordinates
    const validActivities = activities.filter(
      activity => activity.latitude && activity.longitude
    );

    if (validActivities.length < 2) return;

    // Calculate total distance for the info panel
    let totalDistance = 0;

    // Create a label for each segment
    for (let i = 0; i < validActivities.length - 1; i++) {
      const activity1 = validActivities[i];
      const activity2 = validActivities[i + 1];

      const lat1 = activity1.latitude;
      const lon1 = activity1.longitude;
      const lat2 = activity2.latitude;
      const lon2 = activity2.longitude;

      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      totalDistance += distance;

      // Calculate midpoint for label placement
      const midLat = (lat1 + lat2) / 2;
      const midLon = (lon1 + lon2) / 2;

      // Format distance text
      const distanceText = distance < 1
        ? `${Math.round(distance * 1000)} m`
        : `${distance.toFixed(1)} km`;

      // Create distance label marker
      const labelIcon = L.divIcon({
        className: 'map-distance-label',
        html: `<div class="distance-label-content">${distanceText}</div>`,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });

      const labelMarker = L.marker([midLat, midLon], {
        icon: labelIcon,
        interactive: false,
      }).addTo(map);

      distanceLabels.push(labelMarker);
    }

    // Show total distance in info panel
    const totalTravelTime = Math.round((totalDistance / 50) * 60); // Assuming 50 km/h average
    const infoEl = document.getElementById('map-info');
    if (infoEl) {
      const content = infoEl.querySelector('.map-info-content');
      content.innerHTML = `
        <strong>${t('map.totalDistance')}</strong> ${totalDistance.toFixed(1)} km<br>
        <strong>${t('map.estTravelTime')}</strong> ~${totalTravelTime} min
      `;
      infoEl.style.display = 'block';
    }
  }

  /**
   * Hide distance labels
   */
  function hideDistanceLabels() {
    distanceLabels.forEach(label => map.removeLayer(label));
    distanceLabels = [];

    // Hide info panel
    const infoEl = document.getElementById('map-info');
    if (infoEl) {
      infoEl.style.display = 'none';
    }
  }

  /**
   * T183: Toggle distance labels visibility on route
   */
  function toggleDistanceMode() {
    distanceLabelsVisible = !distanceLabelsVisible;

    if (distanceLabelsVisible) {
      showDistanceLabels();
    } else {
      hideDistanceLabels();
    }

    // Update button icon
    const icon = document.getElementById('distance-mode-icon');
    if (icon) {
      icon.textContent = distanceLabelsVisible ? '👁️' : '📏';
    }

    // Update button style
    const btn = document.querySelector('[data-action="toggle-distance-mode"]');
    if (btn) {
      if (distanceLabelsVisible) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    }

    return distanceLabelsVisible;
  }

  /**
   * Helper: Convert degrees to radians
   */
  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clean up map instance
   */
  function destroy() {
    markers.forEach(marker => map.removeLayer(marker));
    if (routePolyline) {
      map.removeLayer(routePolyline);
    }
    // Clean up transport polylines
    transportPolylines.forEach(pl => map.removeLayer(pl));
    transportPolylines = [];
    // Clean up arrow decorators
    arrowDecorators.forEach(d => map.removeLayer(d));
    arrowDecorators = [];
    // Clean up day legend
    removeDayLegend();
    // Clean up distance labels
    distanceLabels.forEach(label => map.removeLayer(label));
    distanceLabels = [];
    map.remove();
  }

  // Initialize with activities
  addMarkers(activities);

  // Return map instance and utilities
  return {
    map,
    markers,
    addMarkers,
    updateActivities,
    drawRoute,
    toggleRoute,
    toggleDistanceMode,
    fitBounds,
    zoomToActivity,
    showDistanceInfo,
    destroy,
    get routeVisible() {
      return routeVisible;
    },
    get distanceLabelsVisible() {
      return distanceLabelsVisible;
    }
  };
}

/**
 * Generate Google Maps URL with waypoints
 * @param {Array} activities - Activities with coordinates
 * @returns {string} Google Maps URL
 */
export function generateGoogleMapsUrl(activities) {
  const validActivities = activities.filter(
    activity => activity.latitude && activity.longitude
  );

  if (validActivities.length === 0) {
    return null;
  }

  if (validActivities.length === 1) {
    const activity = validActivities[0];
    return `https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`;
  }

  // First and last are origin and destination
  const origin = validActivities[0];
  const destination = validActivities[validActivities.length - 1];

  // Middle points are waypoints
  const waypoints = validActivities.slice(1, -1)
    .map(a => `${a.latitude},${a.longitude}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1`;
  url += `&origin=${origin.latitude},${origin.longitude}`;
  url += `&destination=${destination.latitude},${destination.longitude}`;

  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }

  return url;
}

/**
 * Format datetime string for display
 * @param {string} isoString - ISO datetime string
 * @returns {string} Formatted date/time
 */
function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
