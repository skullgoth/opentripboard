// Reservation CRUD, reorder, and date-change handlers.

import { ctx } from './state.js';
import { getTypeLabel, buildIsoDateTime } from './helpers.js';
import { refreshTimeline } from './timeline.js';
import { tripState } from '../../state/trip-state.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';
import { confirmDialog } from '../../utils/confirm-dialog.js';
import { logError } from '../../utils/error-tracking.js';

/**
 * Handle add reservation — creates inline reservation directly
 * @param {string} defaultType - Default reservation type
 */
export async function handleAddReservation(defaultType) {
  if (!ctx.currentTrip) return;

  try {
    const newActivity = await tripState.createActivity(ctx.currentTrip.id, {
      type: defaultType,
      title: t('reservation.new', { type: getTypeLabel(defaultType) }),
      metadata: {},
    });

    ctx.pendingActivityIds.add(newActivity.id);

    if (!ctx.currentActivities.find((a) => a.id === newActivity.id)) {
      ctx.currentActivities.push(newActivity);
    }

    refreshTimeline();

    setTimeout(() => {
      const card = document.querySelector(
        `.activity-card[data-activity-id="${newActivity.id}"]`
      );
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
      setTimeout(() => {
        ctx.pendingActivityIds.delete(newActivity.id);
      }, 2000);
    }, 100);
  } catch (error) {
    logError('Failed to create activity:', error);
  }
}

/**
 * Handle inline save of a reservation field
 * @param {string} reservationId - Reservation (activity) ID
 * @param {string} reservationType - Type of reservation
 * @param {string} fieldName - Name of the field being updated
 * @param {string} newValue - New value for the field
 * @param {Object} options - Optional settings
 */
export async function handleSaveReservationField(
  reservationId,
  reservationType,
  fieldName,
  newValue,
  options = {}
) {
  const reservation = ctx.currentActivities.find(
    (a) => a.id === reservationId
  );
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  const updates = {};
  const metadataUpdates = { ...reservation.metadata };

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
    updates.startTime = newValue
      ? buildIsoDateTime(newValue, metadataUpdates.departureTime)
      : null;
  } else if (fieldName === 'departureTime') {
    metadataUpdates.departureTime = newValue || null;
    const dateField = reservation.startTime
      ? reservation.startTime.split('T')[0]
      : null;
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
    updates.startTime = newValue
      ? buildIsoDateTime(newValue, metadataUpdates.reservationTime)
      : null;
  } else if (fieldName === 'reservationTime') {
    metadataUpdates.reservationTime = newValue || null;
    const dateField =
      metadataUpdates.reservationDate ||
      (reservation.startTime ? reservation.startTime.split('T')[0] : null);
    if (dateField) {
      updates.startTime = buildIsoDateTime(dateField, newValue);
    }
  } else if (fieldName === 'eventDate') {
    const timeField = reservation.startTime
      ? reservation.startTime.split('T')[1]?.substring(0, 5)
      : null;
    updates.startTime = newValue
      ? buildIsoDateTime(newValue, timeField)
      : null;
  } else if (fieldName === 'eventTime') {
    const dateField = reservation.startTime
      ? reservation.startTime.split('T')[0]
      : null;
    if (dateField) {
      updates.startTime = buildIsoDateTime(dateField, newValue);
    }
  } else if (fieldName === 'startDate') {
    updates.startTime = newValue ? `${newValue}T12:00:00.000Z` : null;
  } else if (fieldName === 'endDate') {
    updates.endTime = newValue ? `${newValue}T12:00:00.000Z` : null;
  } else if (fieldName === 'partySize') {
    metadataUpdates.partySize = newValue ? parseInt(newValue, 10) : null;
  } else if (fieldName === 'latitude') {
    updates.latitude = newValue ? parseFloat(newValue) : null;
  } else if (fieldName === 'longitude') {
    updates.longitude = newValue ? parseFloat(newValue) : null;
  } else {
    metadataUpdates[fieldName] = newValue || null;
  }

  if (Object.keys(metadataUpdates).length > 0) {
    updates.metadata = metadataUpdates;
  }

  if (Object.keys(updates).length > 0) {
    try {
      const updatedActivity = await tripState.updateActivity(
        reservationId,
        updates
      );
      const index = ctx.currentActivities.findIndex(
        (a) => a.id === reservationId
      );
      if (index !== -1 && updatedActivity) {
        ctx.currentActivities[index] = updatedActivity;
      }
      if (!options.silent) {
        showToast(t('activity.saved'), 'success');
      }
    } catch (error) {
      logError('Failed to save reservation field:', error);
      if (!options.silent) {
        showToast(t('activity.saveFailed'), 'error');
      }
      throw error;
    }
  }
}

/**
 * Handle reservation type change — refresh to show new type-specific fields
 * @param {string} reservationId - Reservation (activity) ID
 * @param {string} newType - New reservation type
 */
export async function handleReservationTypeChange(reservationId, newType) {
  const reservation = ctx.currentActivities.find(
    (a) => a.id === reservationId
  );
  if (reservation) {
    reservation.type = newType;
  }
  refreshTimeline();
}

/**
 * Handle delete reservation
 * @param {string} reservationId - Reservation (activity) ID
 */
export async function handleDeleteReservation(reservationId) {
  const confirmed = await confirmDialog({ message: t('reservation.confirmDelete'), variant: 'danger' });
  if (!confirmed) return;

  try {
    await tripState.deleteActivity(reservationId);

    ctx.currentActivities = ctx.currentActivities.filter(
      (a) => a.id !== reservationId
    );
    refreshTimeline();
    showToast(t('reservation.deleted'), 'success');
  } catch (error) {
    logError('Failed to delete reservation:', error);
    showToast(t('reservation.deleteFailed'), 'error');
  }
}

/**
 * Handle timeline item reorder
 * @param {Array} items - Array of {id, itemType, orderIndex}
 */
export async function handleReorder(items) {
  try {
    const activities = items
      .filter((item) => item.itemType === 'activity')
      .map((item) => ({
        id: item.id,
        orderIndex: item.orderIndex,
      }));

    if (activities.length > 0) {
      await tripState.reorderActivities(ctx.currentTrip.id, activities);
    }
  } catch (error) {
    logError('Failed to reorder items:', error);
    throw error;
  }
}

/**
 * Handle activity date change when dragged to a different day
 * @param {string} activityId - Activity ID
 * @param {string} newDate - New date (YYYY-MM-DD format)
 */
export async function handleActivityDateChange(activityId, newDate) {
  try {
    const activity = ctx.currentActivities.find((a) => a.id === activityId);
    if (!activity) {
      logError('Activity not found:', activityId);
      return;
    }

    let newStartTime;
    let newEndTime = null;

    if (activity.startTime) {
      const currentStart = new Date(activity.startTime);
      const [year, month, day] = newDate.split('-').map(Number);
      currentStart.setFullYear(year, month - 1, day);
      newStartTime = currentStart.toISOString();

      if (activity.endTime) {
        const currentEnd = new Date(activity.endTime);
        const duration =
          currentEnd.getTime() - new Date(activity.startTime).getTime();
        newEndTime = new Date(currentStart.getTime() + duration).toISOString();
      }
    } else {
      newStartTime = new Date(`${newDate}T12:00:00`).toISOString();
    }

    const updates = { startTime: newStartTime };
    if (newEndTime) {
      updates.endTime = newEndTime;
    }

    await tripState.updateActivity(activityId, updates);

    if (activity) {
      activity.startTime = newStartTime;
      if (newEndTime) {
        activity.endTime = newEndTime;
      }
    }

    showToast(t('activity.movedToDate'), 'success');
  } catch (error) {
    logError('Failed to update activity date:', error);
    showToast(t('activity.moveFailed'), 'error');
    throw error;
  }
}
