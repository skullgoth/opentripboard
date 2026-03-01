// Suggestion modal, CRUD, and voting handlers.

import { ctx } from './state.js';
import { refreshSuggestions } from './timeline.js';
import { suggestionState } from '../../state/suggestion-state.js';
import {
  createSuggestionForm,
  attachSuggestionFormListeners,
} from '../../components/suggestion-list.js';
import { t } from '../../utils/i18n.js';
import { showToast } from '../../utils/toast.js';
import { logError } from '../../utils/error-tracking.js';

/**
 * Handle add suggestion button click
 * @param {string} defaultDate - Default date for the suggestion (optional)
 */
export function handleAddSuggestion(defaultDate) {
  showSuggestionModal(null, defaultDate);
}

/**
 * Show suggestion modal
 * @param {Object} suggestion - Existing suggestion (for edit mode)
 * @param {string} defaultDate - Default date to pre-fill (optional)
 */
export function showSuggestionModal(suggestion = null, defaultDate = null) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'suggestion-modal';
  modalContainer.innerHTML = createSuggestionForm(ctx.currentTrip);
  document.body.appendChild(modalContainer);

  if (defaultDate) {
    const startTimeInput = modalContainer.querySelector(
      '#suggestion-start-time'
    );
    if (startTimeInput) {
      startTimeInput.value = `${defaultDate}T12:00`;
    }
  }

  const formHelpers = attachSuggestionFormListeners(modalContainer);

  const form = modalContainer.querySelector('#suggestion-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSuggestionSubmit(new FormData(form), suggestion);
    });
  }

  modalContainer
    .querySelectorAll('[data-action="close-modal"]')
    .forEach((btn) => {
      btn.addEventListener('click', () => closeSuggestionModal());
    });

  const overlay = modalContainer.querySelector('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSuggestionModal();
      }
    });
  }

  requestAnimationFrame(() => {
    if (overlay) overlay.classList.add('open');
  });
}

/**
 * Close suggestion modal
 */
export function closeSuggestionModal() {
  const modalContainer = document.getElementById('suggestion-modal');
  if (modalContainer) {
    modalContainer.classList.remove('active');
    setTimeout(() => {
      modalContainer.remove();
    }, 300);
  }
}

/**
 * Handle suggestion form submission
 * @param {FormData} formData - Form data from suggestion form
 * @param {Object} existingSuggestion - Existing suggestion (for edit mode)
 */
export async function handleSuggestionSubmit(formData, existingSuggestion) {
  try {
    const suggestionData = {
      activityType: formData.get('activityType'),
      title: formData.get('title'),
    };

    const description = formData.get('description');
    if (description && description.trim()) {
      suggestionData.description = description.trim();
    }

    const location = formData.get('location');
    if (location && location.trim()) {
      suggestionData.location = location.trim();
    }

    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    if (latitude && longitude) {
      suggestionData.latitude = parseFloat(latitude);
      suggestionData.longitude = parseFloat(longitude);
    }

    const startTime = formData.get('startTime');
    if (startTime) {
      suggestionData.startTime = new Date(startTime).toISOString();
    }

    const endTime = formData.get('endTime');
    if (endTime) {
      suggestionData.endTime = new Date(endTime).toISOString();
    }

    if (existingSuggestion) {
      await suggestionState.updateSuggestion(
        existingSuggestion.id,
        suggestionData
      );
    } else {
      await suggestionState.createSuggestion(
        ctx.currentTrip.id,
        suggestionData
      );
    }

    closeSuggestionModal();
    await refreshSuggestions();
  } catch (error) {
    logError('Failed to save suggestion:', error);
    showToast(t('suggestion.saveFailed'), 'error');
  }
}

/**
 * Handle vote on suggestion
 * @param {string} suggestionId - Suggestion ID
 * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
 */
export async function handleVoteSuggestion(suggestionId, vote) {
  try {
    await suggestionState.voteSuggestion(suggestionId, vote);
    await refreshSuggestions();
  } catch (error) {
    logError('Failed to vote on suggestion:', error);
    showToast(t('suggestion.voteFailed'), 'error');
  }
}

/**
 * Handle accept suggestion
 * @param {string} suggestionId - Suggestion ID
 */
export async function handleAcceptSuggestion(suggestionId) {
  try {
    await suggestionState.acceptSuggestion(suggestionId);

    await Promise.all([
      refreshSuggestions(),
      ctx.reloadPage
        ? ctx.reloadPage(ctx.currentTrip.id)
        : Promise.resolve(),
    ]);

    showToast(t('suggestion.accepted'), 'success');
  } catch (error) {
    logError('Failed to accept suggestion:', error);
    showToast(t('suggestion.acceptFailed'), 'error');
  }
}

/**
 * Handle reject suggestion
 * @param {string} suggestionId - Suggestion ID
 */
export async function handleRejectSuggestion(suggestionId) {
  try {
    await suggestionState.rejectSuggestion(suggestionId);
    await refreshSuggestions();
  } catch (error) {
    logError('Failed to reject suggestion:', error);
    showToast(t('suggestion.rejectFailed'), 'error');
  }
}
