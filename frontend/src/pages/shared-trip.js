// US9: Public shared trip view page (no authentication required)

import { escapeHtml } from '../utils/html.js';
import { logError } from '../utils/error-tracking.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Render shared trip page
 * @param {string} token - Share token from URL
 */
export async function sharedTripPage(token) {
  const container = document.getElementById('page-container');

  // Show loading state
  container.innerHTML = `
    <div class="shared-trip-loading">
      <div class="spinner"></div>
      <p>Loading shared trip...</p>
    </div>
  `;

  try {
    // Fetch shared trip data
    const response = await fetch(`${API_BASE_URL}/shared/${token}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('This share link is invalid or has expired.');
      }
      throw new Error('Failed to load shared trip');
    }

    const data = await response.json();
    renderSharedTrip(container, data);
  } catch (error) {
    logError('Failed to load shared trip:', error);
    container.innerHTML = `
      <div class="shared-trip-error">
        <div class="error-icon">🔗</div>
        <h2>Link Not Found</h2>
        <p>${escapeHtml(error.message)}</p>
        <a href="#/" class="btn btn-primary">Go to Home</a>
      </div>
    `;
  }
}

/**
 * Render the shared trip content
 */
function renderSharedTrip(container, data) {
  const { trip, activities, tripBuddies, permission } = data;

  // Format dates
  const dateRange = formatDateRange(trip.startDate, trip.endDate);

  // Group activities by date
  const groupedActivities = groupActivitiesByDate(activities);
  // Sort dates, keeping 'unscheduled' at the end
  const dates = Object.keys(groupedActivities).sort((a, b) => {
    if (a === 'unscheduled') return 1;
    if (b === 'unscheduled') return -1;
    return a.localeCompare(b);
  });

  // Generate trip buddies HTML
  const buddiesHtml = tripBuddies && tripBuddies.length > 0
    ? tripBuddies.map(b => `<span class="shared-buddy">${escapeHtml(b.name || 'Unknown')}</span>`).join('')
    : '';

  container.innerHTML = `
    <div class="shared-trip-page">
      <div class="shared-trip-header">
        ${trip.coverImageUrl ? `
          <div class="shared-trip-cover" style="background-image: url('${escapeHtml(trip.coverImageUrl)}')"></div>
        ` : `
          <div class="shared-trip-cover shared-trip-cover-default"></div>
        `}
        <div class="shared-trip-info">
          <div class="shared-badge">
            <span class="shared-badge-icon">🔗</span>
            <span>Shared Trip</span>
          </div>
          <h1>${escapeHtml(trip.name)}</h1>
          ${trip.destination ? `<div class="shared-trip-destination">📍 ${escapeHtml(trip.destination)}</div>` : ''}
          ${dateRange ? `<div class="shared-trip-dates">📅 ${dateRange}</div>` : ''}
          ${trip.owner ? `<div class="shared-trip-owner">Created by ${escapeHtml(trip.owner.name || 'Unknown')}</div>` : ''}
          ${buddiesHtml ? `<div class="shared-trip-buddies">${buddiesHtml}</div>` : ''}
        </div>
      </div>

      <div class="shared-trip-content">
        ${trip.budget ? `
          <div class="shared-trip-budget">
            <span class="budget-label">Budget:</span>
            <span class="budget-value">${trip.currency || 'USD'} ${trip.budget.toLocaleString()}</span>
          </div>
        ` : ''}

        <div class="shared-trip-itinerary">
          <h2>Itinerary</h2>
          ${dates.length > 0 ? (() => {
            let dayNum = 0;
            return dates.map((date) => {
              if (date !== 'unscheduled') dayNum++;
              return renderDaySection(date, dayNum, groupedActivities[date]);
            }).join('');
          })() : `
            <p class="no-activities">No activities planned yet.</p>
          `}
        </div>
      </div>

      <div class="shared-trip-footer">
        <p>Shared via <a href="#/">OpenTripBoard</a></p>
      </div>
    </div>
  `;
}

/**
 * Render a day section with activities
 */
function renderDaySection(date, dayNumber, activities) {
  const isUnscheduled = date === 'unscheduled';
  const formattedDate = isUnscheduled ? '' : formatDate(date);

  return `
    <div class="shared-day-section">
      <div class="shared-day-header">
        <span class="day-number">${isUnscheduled ? 'Unscheduled' : `Day ${dayNumber}`}</span>
        ${formattedDate ? `<span class="day-date">${formattedDate}</span>` : ''}
      </div>
      <div class="shared-day-activities">
        ${activities.map(activity => renderActivityCard(activity)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render an activity card
 */
function renderActivityCard(activity) {
  const timeStr = activity.startTime
    ? formatTime(activity.startTime)
    : '';

  const typeIcon = getActivityTypeIcon(activity.type);

  return `
    <div class="shared-activity-card">
      <div class="shared-activity-icon">${typeIcon}</div>
      <div class="shared-activity-content">
        <div class="shared-activity-header">
          <span class="shared-activity-title">${escapeHtml(activity.title)}</span>
          ${timeStr ? `<span class="shared-activity-time">${timeStr}</span>` : ''}
        </div>
        ${activity.address || activity.location ? `
          <div class="shared-activity-location">📍 ${escapeHtml(activity.address || activity.location)}</div>
        ` : ''}
        ${activity.notes ? `
          <div class="shared-activity-notes">${escapeHtml(activity.notes)}</div>
        ` : ''}
        ${activity.metadata?.isReservation && activity.metadata?.confirmationCode ? `
          <div class="shared-activity-confirmation">✓ Confirmation: ${escapeHtml(activity.metadata.confirmationCode)}</div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Group activities by date
 */
function groupActivitiesByDate(activities) {
  return activities.reduce((groups, activity) => {
    const date = activity.date || '';
    // Use 'unscheduled' for activities without a date
    const dateKey = date ? date.split('T')[0] : 'unscheduled';

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);

    // Sort by order_index first, then by time within each day
    groups[dateKey].sort((a, b) => {
      // First sort by orderIndex if available
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
        return a.orderIndex - b.orderIndex;
      }
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      return timeA.localeCompare(timeB);
    });

    return groups;
  }, {});
}

/**
 * Format date range
 */
function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '';

  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = startDate ? new Date(startDate).toLocaleDateString(undefined, options) : '';
  const end = endDate ? new Date(endDate).toLocaleDateString(undefined, options) : '';

  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end;
}

/**
 * Format a single date
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format time
 */
function formatTime(timeStr) {
  if (!timeStr) return '';
  // Handle full ISO timestamp (e.g., "2026-07-02T10:00:00.000Z")
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get icon for activity type
 */
function getActivityTypeIcon(type) {
  const icons = {
    // From activity-card.js (standard activities)
    flight: '✈️',
    accommodation: '🏨',
    restaurant: '🍽️',
    attraction: '🎭',
    transportation: '🚗',
    meeting: '👥',
    event: '🎉',
    other: '📌',
    // From trip-reservations.js (reservations)
    hotel: '🏨',
    rental: '🏠',
    bus: '🚌',
    car: '🚗',
    cruise: '🚢',
    ferry: '⛴️',
    train: '🚆',
    bar: '🍸',
  };

  return icons[type] || '📌';
}

