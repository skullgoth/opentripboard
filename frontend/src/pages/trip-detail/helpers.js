// Pure utility functions used across trip-detail sub-modules.

import { ctx } from './state.js';
import { t } from '../../utils/i18n.js';
import { isLodgingType } from '../../utils/default-categories.js';
import { escapeHtml } from '../../utils/html.js';

/**
 * Calculate the maximum orderIndex for activities on a given date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {number} Maximum orderIndex found
 */
export function calculateMaxOrderIndex(date) {
  let maxOrderIndex = 0;
  ctx.currentActivities.forEach((activity) => {
    const activityDate = activity.startTime ? activity.startTime.split('T')[0] : null;
    if (activityDate === date || (!activityDate && !date)) {
      if ((activity.orderIndex || 0) > maxOrderIndex) {
        maxOrderIndex = activity.orderIndex || 0;
      }
    }
  });
  return maxOrderIndex;
}

/**
 * Get human-readable label for a type
 * @param {string} type - Reservation type
 * @returns {string} Label
 */
export function getTypeLabel(type) {
  const translationKey = `reservation.types.${type}`;
  const translated = t(translationKey);
  return translated !== translationKey ? translated : type;
}

/**
 * Build ISO datetime string from date and time
 */
export function buildIsoDateTime(date, time) {
  if (!date) return null;
  if (time) {
    return `${date}T${time}:00.000Z`;
  }
  return `${date}T12:00:00.000Z`;
}

/**
 * Get cover image URL with default fallback
 * @param {Object} trip - Trip object
 * @returns {string} Cover image URL
 */
export function getCoverImageUrl(trip) {
  if (trip.coverImageUrl) {
    return trip.coverImageUrl;
  }
  return '/images/placeholder-trip.svg';
}

/**
 * Render cover image attribution
 * @param {Object} trip - Trip object
 * @returns {string} Attribution HTML
 */
export function renderCoverImageAttribution(trip) {
  const attribution = trip.coverImageAttribution;

  if (!attribution || attribution.source === 'placeholder') {
    return '';
  }

  if (attribution.source === 'user_upload') {
    return '';
  }

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
