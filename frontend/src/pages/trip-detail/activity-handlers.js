// Activity CRUD handlers.

import { ctx } from './state.js';
import { calculateMaxOrderIndex } from './helpers.js';
import { refreshTimeline } from './timeline.js';
import { tripState } from '../../state/trip-state.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';
import { isLodgingType } from '../../utils/default-categories.js';
import { logError, logWarning } from '../../utils/error-tracking.js';

/**
 * Handle add activity — creates inline activity directly
 * @param {string} defaultDate - Default date for activity
 * @param {string} afterActivityId - Optional ID of activity to insert after
 */
export async function handleAddActivity(defaultDate, afterActivityId = null) {
  if (!ctx.currentTrip) return;

  try {
    const startTime = defaultDate ? `${defaultDate}T12:00:00.000Z` : null;

    let orderIndex;

    if (afterActivityId === '') {
      // Empty string means insert at the beginning of the day
      const dayActivities = ctx.currentActivities
        .filter((a) => {
          const activityStartDate = a.startTime
            ? a.startTime.split('T')[0]
            : null;
          const activityEndDate = a.endTime ? a.endTime.split('T')[0] : null;
          if (activityStartDate === defaultDate) return true;
          if (isLodgingType(a.type) && activityStartDate && activityEndDate) {
            return (
              activityStartDate <= defaultDate &&
              defaultDate <= activityEndDate
            );
          }
          return false;
        })
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      for (const activity of dayActivities) {
        activity.orderIndex = (activity.orderIndex || 0) + 1;
        tripState
          .updateActivity(ctx.currentTrip.id, activity.id, {
            orderIndex: activity.orderIndex,
          })
          .catch(() => {});
      }
      orderIndex = 0;
    } else if (afterActivityId) {
      const afterActivity = ctx.currentActivities.find(
        (a) => a.id === afterActivityId
      );
      if (afterActivity) {
        const dayActivities = ctx.currentActivities
          .filter((a) => {
            const activityStartDate = a.startTime
              ? a.startTime.split('T')[0]
              : null;
            const activityEndDate = a.endTime
              ? a.endTime.split('T')[0]
              : null;

            if (activityStartDate === defaultDate) return true;

            if (
              isLodgingType(a.type) &&
              activityStartDate &&
              activityEndDate
            ) {
              return (
                activityStartDate <= defaultDate &&
                defaultDate <= activityEndDate
              );
            }

            return false;
          })
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        const afterIndex = dayActivities.findIndex(
          (a) => a.id === afterActivityId
        );
        const afterOrder = afterActivity.orderIndex || 0;

        if (afterIndex !== -1 && afterIndex < dayActivities.length - 1) {
          const nextActivity = dayActivities[afterIndex + 1];
          const nextOrder = nextActivity.orderIndex || 0;

          if (nextOrder - afterOrder > 1) {
            orderIndex = Math.floor(
              afterOrder + (nextOrder - afterOrder) / 2
            );
          } else {
            const activitiesToShift = dayActivities.slice(afterIndex + 1);
            for (const activity of activitiesToShift) {
              activity.orderIndex = (activity.orderIndex || 0) + 1;
              tripState
                .updateActivity(ctx.currentTrip.id, activity.id, {
                  orderIndex: activity.orderIndex,
                })
                .catch(() => {});
            }
            orderIndex = afterOrder + 1;
          }
        } else {
          orderIndex = afterOrder + 1;
        }
      } else {
        orderIndex = calculateMaxOrderIndex(defaultDate) + 1;
      }
    } else {
      orderIndex = calculateMaxOrderIndex(defaultDate) + 1;
    }

    const newActivity = await tripState.createActivity(ctx.currentTrip.id, {
      type: 'sightseeing',
      title: t('activity.newActivity'),
      startTime,
      orderIndex,
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
    showToast(t('activity.createFailed'), 'error');
  }
}

/**
 * Handle edit activity — expands the activity card for inline editing
 * @param {string} activityId - Activity ID
 */
export function handleEditActivity(activityId) {
  const card = document.querySelector(
    `.activity-card[data-activity-id="${activityId}"]`
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
}

/**
 * Handle delete activity
 * @param {string} activityId - Activity ID
 */
export async function handleDeleteActivity(activityId) {
  try {
    await tripState.deleteActivity(activityId);

    ctx.currentActivities = ctx.currentActivities.filter(
      (a) => a.id !== activityId
    );
    refreshTimeline();
    showToast(t('activity.deleted'), 'success');
  } catch (error) {
    logError('Failed to delete activity:', error);
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
export async function handleSaveActivityField(
  activityId,
  fieldName,
  newValue,
  options = {}
) {
  const activity = ctx.currentActivities.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error('Activity not found');
  }

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
    updates.startTime = newValue ? new Date(newValue).toISOString() : null;
  } else if (fieldName === 'endTime') {
    updates.endTime = newValue ? new Date(newValue).toISOString() : null;
  } else {
    logWarning('Unknown activity field:', fieldName);
    return;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await tripState.updateActivity(activityId, updates);
      if (!options.silent) {
        showToast(t('activity.saved'), 'success');
      }
    } catch (error) {
      logError('Failed to save activity field:', error);
      if (!options.silent) {
        showToast(t('activity.saveFailed'), 'error');
      }
      throw error;
    }
  }
}

/**
 * Handle transport change between activities
 * @param {string} activityId - Activity ID that owns the transport
 * @param {Object} transportData - Transport data
 * @param {Object} options - Options { skipRefresh: boolean }
 */
export async function handleTransportChange(
  activityId,
  transportData,
  options = {}
) {
  const activity = ctx.currentActivities.find((a) => a.id === activityId);
  if (!activity) {
    logError('Activity not found for transport change:', activityId);
    return;
  }

  try {
    const updatedMetadata = {
      ...(activity.metadata || {}),
      transportToNext: transportData,
    };

    await tripState.updateActivity(activityId, { metadata: updatedMetadata });

    activity.metadata = updatedMetadata;

    if (!options.skipRefresh) {
      refreshTimeline();
    }
  } catch (error) {
    logError('Failed to save transport:', error);
    if (!options.skipRefresh) {
      showToast(t('activity.saveFailed'), 'error');
    }
  }
}
