// Trip edit/delete, cover image, export, and buddy management.

import { ctx } from './state.js';
import {
  createTripForm,
  attachTripFormListeners,
} from '../../components/trip-form.js';
import {
  createTripBuddyList,
  createCompactTripBuddyList,
} from '../../components/trip-buddy-list.js';
import {
  createInviteTripBuddyModal,
  validateInviteTripBuddyForm,
  displayFormErrors,
} from '../../components/invite-trip-buddy-form.js';
import { showToast } from '../../utils/toast.js';
import { confirmDialog, alertDialog } from '../../utils/confirm-dialog.js';
import { tripState } from '../../state/trip-state.js';
import { tripBuddyState } from '../../state/trip-buddy-state.js';
import { authState } from '../../state/auth-state.js';
import { app } from '../../main.js';
import { t } from '../../utils/i18n.js';
import {
  generateGoogleMapsUrl as generateRouteMapsUrl,
  openInGoogleMaps,
} from '../../utils/google-maps.js';

// --- Trip modal ---

/**
 * Show trip edit modal
 * @param {Object} trip - Trip data to edit
 */
export function showTripModal(trip) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'trip-modal';
  modalContainer.innerHTML = createTripForm(trip);
  document.body.appendChild(modalContainer);

  attachTripFormListeners(
    modalContainer,
    async (tripData) => {
      await handleTripSubmit(tripData, trip);
    },
    () => {
      closeTripModal();
    }
  );

  requestAnimationFrame(() => {
    modalContainer.classList.add('active');
  });
}

/**
 * Close trip modal
 */
export function closeTripModal() {
  const modalContainer = document.getElementById('trip-modal');
  if (modalContainer) {
    modalContainer.classList.remove('active');
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

/**
 * Handle trip form submission
 * @param {Object} tripData - Trip data from form
 * @param {Object} existingTrip - Existing trip being edited
 */
export async function handleTripSubmit(tripData, existingTrip) {
  try {
    const coverImageFile = tripData.coverImage;
    const { coverImage, ...tripUpdateData } = tripData;

    await tripState.updateTrip(existingTrip.id, tripUpdateData);

    if (
      coverImageFile &&
      coverImageFile instanceof File &&
      coverImageFile.size > 0
    ) {
      await tripState.uploadCoverImage(existingTrip.id, coverImageFile);
    }

    closeTripModal();

    if (ctx.reloadPage) {
      await ctx.reloadPage(existingTrip.id);
    }
  } catch (error) {
    console.error('Failed to update trip:', error);
    throw error;
  }
}

// --- Cover image ---

/**
 * Handle edit cover image button click
 */
export function handleEditCoverImage() {
  const input = document.getElementById('cover-image-input');
  if (input) {
    input.click();
  }
}

/**
 * Handle cover image upload
 * @param {File} file - Cover image file
 */
export async function handleCoverImageUpload(file) {
  if (!ctx.currentTrip) {
    return;
  }

  try {
    const { validateCoverImage } = await import('../../utils/validators.js');
    const validation = validateCoverImage(file);

    if (!validation.valid) {
      await alertDialog({ title: t('common.error'), message: validation.errors.join('\n') });
      return;
    }

    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '0.5';
    }

    await tripState.uploadCoverImage(ctx.currentTrip.id, file);

    if (ctx.reloadPage) {
      await ctx.reloadPage(ctx.currentTrip.id);
    }
  } catch (error) {
    console.error('Failed to upload cover image:', error);
    showToast(t('cover.uploadFailed'), 'error');

    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '1';
    }
  }
}

/**
 * Handle delete cover image button click
 */
export async function handleDeleteCoverImage() {
  if (!ctx.currentTrip) return;

  const confirmed = await confirmDialog({ message: t('cover.confirmRemove'), variant: 'danger' });
  if (!confirmed) return;

  try {
    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '0.5';
    }

    await tripState.deleteCoverImage(ctx.currentTrip.id);

    if (ctx.reloadPage) {
      await ctx.reloadPage(ctx.currentTrip.id);
    }
  } catch (error) {
    console.error('Failed to delete cover image:', error);
    showToast(t('cover.deleteFailed'), 'error');

    const coverImage = document.querySelector('.trip-cover-image');
    if (coverImage) {
      coverImage.style.opacity = '1';
    }
  }
}

// --- Trip delete ---

/**
 * Handle delete trip button click
 * @param {Object} trip - Trip to delete
 */
export async function handleDeleteTrip(trip) {
  if (!trip) return;

  const confirmed = await confirmDialog({ message: t('trip.confirmDelete', { name: trip.name }), variant: 'danger' });
  if (!confirmed) return;

  try {
    await tripState.deleteTrip(trip.id);
    app.router.navigate('/');
  } catch (error) {
    console.error('Failed to delete trip:', error);
    showToast(t('trip.deleteFailed'), 'error');
  }
}

// --- Export ---

/**
 * Handle export to Google Maps (trip menu button)
 */
export function handleExportGoogleMaps() {
  if (!ctx.currentActivities || ctx.currentActivities.length === 0) {
    showToast(t('map.noLocations'), 'warning');
    return;
  }

  const url = generateRouteMapsUrl(ctx.currentActivities);
  if (!url) {
    showToast(t('map.noCoordinates'), 'warning');
    return;
  }

  openInGoogleMaps(url);
  showToast(t('map.openingGoogleMaps'), 'info');
}

// --- Buddy management ---

/**
 * Attach trip buddy event listeners
 */
export function attachTripBuddyListeners() {
  const inviteButtons = document.querySelectorAll(
    '[data-action="invite-trip-buddy"]'
  );
  inviteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      showInviteTripBuddyModal();
    });
  });

  const removeButtons = document.querySelectorAll(
    '[data-action="remove-trip-buddy"]'
  );
  removeButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tripBuddyId = btn.getAttribute('data-trip-buddy-id');
      if (tripBuddyId) {
        await handleRemoveTripBuddy(tripBuddyId);
      }
    });
  });
}

/**
 * Show invite trip buddy modal
 */
export function showInviteTripBuddyModal() {
  if (!ctx.currentTrip) return;

  const modalHtml = createInviteTripBuddyModal(ctx.currentTrip.id);
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer.firstElementChild);

  const modal = document.getElementById('invite-trip-buddy-modal');
  if (!modal) return;

  const closeButtons = modal.querySelectorAll('[data-action="close-modal"]');
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', closeInviteTripBuddyModal);
  });

  const form = document.getElementById('invite-trip-buddy-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      await handleInviteTripBuddy(formData);
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeInviteTripBuddyModal();
    }
  });

  requestAnimationFrame(() => {
    modal.classList.add('open');
  });
}

/**
 * Close invite trip buddy modal
 */
export function closeInviteTripBuddyModal() {
  const modal = document.getElementById('invite-trip-buddy-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Handle invite trip buddy form submission
 * @param {FormData} formData - Form data
 */
export async function handleInviteTripBuddy(formData) {
  try {
    const validation = validateInviteTripBuddyForm(formData);
    if (!validation.valid) {
      displayFormErrors(validation.errors);
      return;
    }

    const tripBuddyData = {
      email: formData.get('email').trim(),
      role: formData.get('role'),
    };

    await tripBuddyState.inviteTripBuddy(ctx.currentTrip.id, tripBuddyData);

    closeInviteTripBuddyModal();
    await refreshTripBuddies();

    showToast(t('tripBuddy.inviteSuccess'), 'success');
  } catch (error) {
    console.error('Failed to invite trip buddy:', error);
    showToast(error.message || t('tripBuddy.inviteFailed'), 'error');
  }
}

/**
 * Handle remove trip buddy
 * @param {string} tripBuddyId - Trip buddy ID
 */
export async function handleRemoveTripBuddy(tripBuddyId) {
  try {
    const confirmed = await confirmDialog({ message: t('tripBuddy.confirmRemove'), variant: 'danger' });
    if (!confirmed) return;

    await tripBuddyState.removeTripBuddy(tripBuddyId);
    await refreshTripBuddies();

    showToast(t('tripBuddy.removeSuccess'), 'success');
  } catch (error) {
    console.error('Failed to remove trip buddy:', error);
    showToast(error.message || t('tripBuddy.removeFailed'), 'error');
  }
}

/**
 * Refresh tripBuddies list
 */
export async function refreshTripBuddies() {
  try {
    if (!ctx.currentTrip) return;

    const tripBuddies = await tripBuddyState.loadTripBuddies(
      ctx.currentTrip.id
    );
    ctx.currentTripBuddies = tripBuddies;

    const currentUser = authState.getCurrentUser();
    const isOwner = ctx.currentTrip.ownerId === currentUser?.id;

    const tripBuddiesContainer = document.getElementById(
      'trip-buddies-container'
    );
    if (tripBuddiesContainer) {
      const tripBuddyListHtml = createTripBuddyList(
        tripBuddies,
        ctx.currentTrip.ownerId,
        currentUser?.id,
        isOwner,
        ctx.activeUsers
      );
      tripBuddiesContainer.innerHTML = tripBuddyListHtml;
      attachTripBuddyListeners();
    }

    const tripBuddiesInline = document.querySelector('.trip-buddies-inline');
    if (tripBuddiesInline) {
      const tripBuddyCompactHtml = createCompactTripBuddyList(
        tripBuddies,
        currentUser?.id,
        isOwner,
        ctx.activeUsers
      );
      tripBuddiesInline.innerHTML = tripBuddyCompactHtml;
    }
  } catch (error) {
    console.error('Failed to refresh tripBuddies:', error);
  }
}
