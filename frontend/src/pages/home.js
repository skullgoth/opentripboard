// T076: Home page - display trips list and handle trip creation
import {
  createTripList,
  createTripListSkeleton,
  attachTripListListeners,
} from '../components/trip-list.js';
import { createTripForm, attachTripFormListeners } from '../components/trip-form.js';
import { app } from '../main.js';
import { tripState } from '../state/trip-state.js';
import { authState } from '../state/auth-state.js';
import { t } from '../utils/i18n.js';
import { confirmDialog } from '../utils/confirm-dialog.js';
import { showToast } from '../utils/toast.js';

/**
 * Render home page
 */
export async function homePage() {
  const container = document.getElementById('page-container');

  // Check authentication (T084: Loading states and error handling)
  if (!authState.isAuthenticated()) {
    container.innerHTML = `
      <div class="welcome-page">
        <div class="welcome-content">
          <h1>${t('home.welcome')}</h1>
          <p>${t('home.welcomeSubtitle')}</p>
          <p>${t('home.welcomeDescription')}</p>
          <div class="welcome-actions">
            <a href="#/login" class="btn btn-primary btn-lg">${t('auth.login')}</a>
            <a href="#/register" class="btn btn-secondary btn-lg">${t('auth.register')}</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Show skeleton loading state (T084)
  container.innerHTML = createTripListSkeleton();

  try {
    // T081: Wire trip creation flow - Load trips from API
    const trips = await tripState.loadTrips();

    // Render trip list
    const html = createTripList(
      trips,
      handleTripClick,
      handleCreateClick
    );

    container.innerHTML = html;

    // Attach listeners
    attachTripListListeners(container, handleTripClick, handleCreateClick, handleDeleteClick);
  } catch (error) {
    // T084: Error handling for API calls
    console.error('[Home] Failed to load trips:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('home.failedToLoad')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <button class="btn btn-sm btn-primary" onclick="window.location.reload()">
          ${t('home.retry')}
        </button>
      </div>
    `;
  }
}

/**
 * Handle trip card click
 * @param {string} tripId - Trip ID
 */
function handleTripClick(tripId) {
  app.router.navigate(`/trips/${tripId}`);
}

/**
 * Handle create trip button click
 */
function handleCreateClick() {
  showTripModal();
}

/**
 * Handle delete trip button click
 * @param {string} tripId - Trip ID
 */
async function handleDeleteClick(tripId) {
  // Find the trip to get its name for the confirmation dialog
  const trips = tripState.getTrips();
  const trip = trips.find(t => t.id === tripId);
  const tripName = trip ? trip.name : 'this trip';

  // Show confirmation dialog
  const confirmed = await confirmDialog({ message: t('home.confirmDelete', { name: tripName }), variant: 'danger' });
  if (!confirmed) return;

  try {
    // Delete the trip
    await tripState.deleteTrip(tripId);

    // Reload the home page to show updated list
    homePage();
  } catch (error) {
    console.error('Failed to delete trip:', error);
    showToast(t('home.deleteFailed'), 'error');
  }
}

/**
 * Show trip creation modal
 * @param {Object} trip - Existing trip data (for edit mode)
 */
function showTripModal(trip = null) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'trip-modal';
  modalContainer.innerHTML = createTripForm(trip);
  document.body.appendChild(modalContainer);

  // Attach listeners
  attachTripFormListeners(
    modalContainer,
    async (tripData) => {
      await handleTripSubmit(tripData, trip);
    },
    () => {
      closeTripModal();
    }
  );

  // Show modal with animation
  requestAnimationFrame(() => {
    modalContainer.classList.add('active');
  });
}

/**
 * Close trip modal
 */
function closeTripModal() {
  const modalContainer = document.getElementById('trip-modal');
  if (modalContainer) {
    modalContainer.classList.remove('active');
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

/**
 * Handle trip form submission (T081, T103: Wire trip creation flow + cover image upload)
 * @param {Object} tripData - Trip data from form
 * @param {Object} existingTrip - Existing trip (for edit mode)
 */
async function handleTripSubmit(tripData, existingTrip) {
  try {
    // T085: Form validation is already handled in trip-form.js

    // Extract cover image file (if provided)
    const coverImageFile = tripData.coverImage;

    // Remove coverImage from tripData as it's not part of the trip object
    const tripDataWithoutImage = { ...tripData };
    delete tripDataWithoutImage.coverImage;

    if (existingTrip) {
      // Update existing trip
      await tripState.updateTrip(existingTrip.id, tripDataWithoutImage);

      // If cover image provided, upload it separately (T103)
      if (coverImageFile && coverImageFile instanceof File && coverImageFile.size > 0) {
        await tripState.uploadCoverImage(existingTrip.id, coverImageFile);
      }
    } else {
      // Create new trip first
      const newTrip = await tripState.createTrip(tripDataWithoutImage);

      // If cover image provided, upload it after trip creation (T103)
      if (coverImageFile && coverImageFile instanceof File && coverImageFile.size > 0) {
        await tripState.uploadCoverImage(newTrip.id, coverImageFile);
      }

      closeTripModal();
      app.router.navigate(`/trips/${newTrip.id}`);
      return;
    }

    // Close modal and refresh
    closeTripModal();
    homePage();
  } catch (error) {
    // T084: Error handling - propagate to form for display
    console.error('Failed to save trip:', error);
    throw error;
  }
}
