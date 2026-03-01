// Transport editor component for selecting transport mode between activities

import { getTransportIcon, getTransportModes } from './transport-icons.js';
import { getRoute, formatDuration, formatDistance, TRANSPORT_MODES } from '../services/routing-api.js';
import { t } from '../utils/i18n.js';

// Default transport mode when auto-calculating
export const DEFAULT_TRANSPORT_MODE = 'drive';

/**
 * Create transport editor dropdown
 * @param {Object} options - Configuration options
 * @param {string} options.activityId - Activity ID (transport is stored in this activity's metadata.transportToNext)
 * @param {Object} options.fromCoords - Origin coordinates {lat, lng}
 * @param {Object} options.toCoords - Destination coordinates {lat, lng}
 * @param {Object} options.currentTransport - Current transport data or null
 * @param {Function} options.onTransportChange - Callback when transport changes: (activityId, transportData) => void
 * @returns {string} HTML string
 */
export function createTransportEditor(options) {
  const {
    activityId,
    fromCoords,
    toCoords,
    currentTransport,
    onTransportChange,
  } = options;

  const currentMode = currentTransport?.mode || DEFAULT_TRANSPORT_MODE;
  const hasCoordinates = fromCoords?.lat && fromCoords?.lng && toCoords?.lat && toCoords?.lng;

  // Build mode options
  const modes = getTransportModes();
  const modeOptions = modes.map((mode) => {
    const icon = getTransportIcon(mode, { size: 18 });
    const isSelected = mode === currentMode;
    return `
      <button
        type="button"
        class="transport-mode-btn ${isSelected ? 'selected' : ''}"
        data-mode="${mode}"
        title="${t(`transport.modes.${mode}`, mode)}"
      >
        ${icon}
        <span class="transport-mode-label">${t(`transport.modes.${mode}`, mode)}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="transport-editor" data-activity-id="${activityId}">
      <div class="transport-editor-header">
        <span class="transport-editor-title">${t('transport.selectMode', 'Select transport mode')}</span>
      </div>
      <div class="transport-mode-options">
        ${modeOptions}
      </div>
      ${!hasCoordinates ? `
        <div class="transport-editor-warning">
          ${t('transport.noCoordinates', 'Add locations to both activities to calculate route')}
        </div>
      ` : ''}
      <div class="transport-editor-loading" style="display: none;">
        <span class="spinner-small"></span>
        <span>${t('transport.calculating', 'Calculating route...')}</span>
      </div>
    </div>
  `;
}

/**
 * Attach transport editor listeners
 * @param {HTMLElement} editorElement - The transport editor element
 * @param {Object} options - Same options as createTransportEditor plus onClose
 */
export function attachTransportEditorListeners(editorElement, options) {
  const {
    activityId,
    fromCoords,
    toCoords,
    onTransportChange,
    onClose,
  } = options;

  const loadingEl = editorElement.querySelector('.transport-editor-loading');
  const hasCoordinates = fromCoords?.lat && fromCoords?.lng && toCoords?.lat && toCoords?.lng;

  editorElement.querySelectorAll('.transport-mode-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mode = btn.dataset.mode;

      // Update selected state
      editorElement.querySelectorAll('.transport-mode-btn').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === mode);
      });

      if (!mode) {
        // Clear transport
        if (onTransportChange) {
          onTransportChange(activityId, null);
        }
        if (onClose) onClose();
        return;
      }

      if (!hasCoordinates) {
        // Can't calculate route without coordinates
        if (onTransportChange) {
          onTransportChange(activityId, { mode, cachedDistance: null, cachedDuration: null, routeGeometry: null, cachedAt: new Date().toISOString() });
        }
        if (onClose) onClose();
        return;
      }

      // Show loading
      loadingEl.style.display = 'flex';

      try {
        const route = await getRoute(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng, mode);

        const transportData = {
          mode,
          cachedDistance: route.distance,
          cachedDuration: route.duration,
          routeGeometry: route.geometry,
          cachedAt: new Date().toISOString(),
        };

        if (onTransportChange) {
          onTransportChange(activityId, transportData);
        }
      } catch (error) {
        console.error('Failed to calculate route:', error);
        // Still save the mode, just without cached data
        if (onTransportChange) {
          onTransportChange(activityId, { mode, cachedDistance: null, cachedDuration: null, routeGeometry: null, cachedAt: new Date().toISOString() });
        }
      } finally {
        loadingEl.style.display = 'none';
        if (onClose) onClose();
      }
    });
  });

  // Click outside to close
  const closeHandler = (e) => {
    if (!editorElement.contains(e.target)) {
      document.removeEventListener('click', closeHandler);
      if (onClose) onClose();
    }
  };

  // Delay adding the close handler to prevent immediate close
  setTimeout(() => {
    document.addEventListener('click', closeHandler);
  }, 10);
}

/**
 * Create transport line between activities (simplified inline display)
 * @param {Object} options - Configuration options
 * @param {string} options.activityId - Activity ID that owns this transport
 * @param {Object} options.transportData - Transport data from activity metadata
 * @param {boolean} options.hasCoordinates - Whether both activities have coordinates
 * @param {string} options.fromLocationName - Name of the origin location (for cross-day display)
 * @param {boolean} options.isCrossDay - Whether this is transport between days
 * @param {boolean} options.isLoading - Whether route is being calculated
 * @param {boolean} options.isEphemeral - Whether this is ephemeral (multi-day non-last day, don't save)
 * @param {number} options.fromLat - Origin latitude (for cross-day, embedded directly)
 * @param {number} options.fromLng - Origin longitude (for cross-day, embedded directly)
 * @param {number} options.toLat - Destination latitude (for cross-day, embedded directly)
 * @param {number} options.toLng - Destination longitude (for cross-day, embedded directly)
 * @param {string} options.targetDate - Target date for adding activity (YYYY-MM-DD format)
 * @returns {string} HTML string
 */
export function createTransportBox(options) {
  const {
    activityId,
    transportData,
    hasCoordinates = false,
    fromLocationName = null,
    isCrossDay = false,
    isLoading = false,
    isEphemeral = false,
    fromLat = null,
    fromLng = null,
    toLat = null,
    toLng = null,
    targetDate = null,
  } = options;

  // Build coordinate data attributes for cross-day transport (multi-day items have same ID across days)
  const coordAttrs = (fromLat && fromLng && toLat && toLng)
    ? `data-from-lat="${fromLat}" data-from-lng="${fromLng}" data-to-lat="${toLat}" data-to-lng="${toLng}"`
    : '';

  // Add activity button - always shown on the left
  // Pass both the date and the activityId (activity before) so the new activity can be inserted at the right position
  const addActivityBtn = targetDate
    ? `<button class="btn-icon-sm transport-add-btn" data-action="add-activity" data-date="${targetDate}" data-after-activity-id="${activityId}" title="${t('trip.addActivity')}">+</button>`
    : '';

  // If loading, show loading indicator
  if (isLoading) {
    const presetMode = transportData?.mode || '';
    return `
      <div class="transport-line transport-line--loading" data-activity-id="${activityId}" data-ephemeral="${isEphemeral}" ${coordAttrs} data-date="${targetDate || ''}"${presetMode ? ` data-preset-mode="${presetMode}"` : ''}>
        ${addActivityBtn}
        <span class="transport-line-loading">
          <span class="spinner-tiny"></span>
        </span>
      </div>
    `;
  }

  // If no coordinates and no transport data, show minimal line with just the add button
  if (!hasCoordinates && !transportData?.mode) {
    if (!targetDate) {
      return '';
    }
    return `
      <div class="transport-line transport-line--minimal"
           data-activity-id="${activityId}"
           data-date="${targetDate}">
        ${addActivityBtn}
      </div>
    `;
  }

  const mode = transportData?.mode || DEFAULT_TRANSPORT_MODE;
  const { cachedDistance, cachedDuration } = transportData || {};
  const icon = getTransportIcon(mode, { size: 16 });

  // Format duration and distance
  const durationText = cachedDuration ? formatDuration(cachedDuration) : '';
  const distanceText = cachedDistance ? formatDistance(cachedDistance) : '';

  // Build the display text
  let displayText = '';
  if (durationText && distanceText) {
    displayText = `${distanceText} · ${durationText}`;
  } else if (durationText) {
    displayText = durationText;
  } else if (distanceText) {
    displayText = distanceText;
  }

  // Cross-day label
  const crossDayLabel = isCrossDay && fromLocationName
    ? `<span class="transport-line-from">${t('transport.from', 'from')} ${fromLocationName}</span>`
    : '';

  return `
    <div class="transport-line ${isCrossDay ? 'transport-line--cross-day' : ''}"
         data-activity-id="${activityId}"
         data-mode="${mode}"
         data-duration="${cachedDuration || 0}"
         data-distance="${cachedDistance || 0}"
         data-date="${targetDate || ''}">
      ${addActivityBtn}
      ${crossDayLabel}
      <span class="transport-line-content" data-action="edit-transport" title="${t('transport.editTransport', 'Click to change transport mode')}">
        <span class="transport-line-icon">${icon}</span>
        <span class="transport-line-info">${displayText}</span>
      </span>
    </div>
  `;
}

/**
 * Calculate route and return transport data
 * @param {Object} fromCoords - Origin coordinates {lat, lng}
 * @param {Object} toCoords - Destination coordinates {lat, lng}
 * @param {string} mode - Transport mode
 * @returns {Promise<Object>} Transport data
 */
export async function calculateRoute(fromCoords, toCoords, mode = DEFAULT_TRANSPORT_MODE) {
  if (!fromCoords?.lat || !fromCoords?.lng || !toCoords?.lat || !toCoords?.lng) {
    return null;
  }

  try {
    const route = await getRoute(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng, mode);
    return {
      mode,
      cachedDistance: route.distance,
      cachedDuration: route.duration,
      routeGeometry: route.geometry,
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to calculate route:', error);
    return {
      mode,
      cachedDistance: null,
      cachedDuration: null,
      routeGeometry: null,
      cachedAt: new Date().toISOString(),
    };
  }
}

export default {
  createTransportEditor,
  attachTransportEditorListeners,
  createTransportBox,
  calculateRoute,
  DEFAULT_TRANSPORT_MODE,
};
