// Invite Trip Buddy Form Component - Form for inviting trip tripBuddys
import { t } from '../utils/i18n.js';

/**
 * Create invite tripBuddy form
 * @param {string} tripId - Trip ID
 * @returns {string} HTML string
 */
export function createInviteTripBuddyForm(tripId) {
  return `
    <form id="invite-trip-buddy-form" class="form" novalidate>
      <div class="form-group">
        <label for="trip-buddy-email">${t('inviteTripBuddy.emailLabel')}</label>
        <input
          type="email"
          id="trip-buddy-email"
          name="email"
          class="form-control"
          placeholder="${t('inviteTripBuddy.emailPlaceholder')}"
          required
          autocomplete="email"
        />
        <div class="form-hint">${t('inviteTripBuddy.emailHint')}</div>
      </div>

      <div class="form-group">
        <label for="trip-buddy-role">${t('inviteTripBuddy.roleLabel')}</label>
        <select
          id="trip-buddy-role"
          name="role"
          class="form-control"
          required
        >
          <option value="">${t('inviteTripBuddy.selectRole')}</option>
          <option value="editor">${t('inviteTripBuddy.roleEditorOption')}</option>
          <option value="viewer">${t('inviteTripBuddy.roleViewerOption')}</option>
        </select>
        <div class="form-hint">${t('inviteTripBuddy.roleHint')}</div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn btn-sm btn-secondary"
          data-action="close-modal"
        >
          ${t('common.cancel')}
        </button>
        <button
          type="submit"
          class="btn btn-sm btn-primary"
        >
          ${t('inviteTripBuddy.sendInvitation')}
        </button>
      </div>
    </form>
  `;
}

/**
 * Create invite tripBuddy modal
 * @param {string} tripId - Trip ID
 * @returns {string} HTML string
 */
export function createInviteTripBuddyModal(tripId) {
  return `
    <div class="modal-overlay" id="invite-trip-buddy-modal">
      <div class="modal-dialog" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title">${t('inviteTripBuddy.modalTitle')}</h2>
          <button
            type="button"
            class="modal-close"
            data-action="close-modal"
            aria-label="${t('common.close')}"
          >
            ×
          </button>
        </div>
        <div class="modal-body">
          ${createInviteTripBuddyForm(tripId)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Validate invite tripBuddy form
 * @param {FormData} formData - Form data
 * @returns {Object} Validation result { valid: boolean, errors: Object }
 */
export function validateInviteTripBuddyForm(formData) {
  const errors = {};
  const email = formData.get('email');
  const role = formData.get('role');

  // Validate email
  if (!email || !email.trim()) {
    errors.email = t('inviteTripBuddy.errors.emailRequired');
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.email = t('inviteTripBuddy.errors.emailInvalid');
    }
  }

  // Validate role
  if (!role || !role.trim()) {
    errors.role = t('inviteTripBuddy.errors.roleRequired');
  } else if (!['editor', 'viewer'].includes(role)) {
    errors.role = t('inviteTripBuddy.errors.roleInvalid');
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Display form validation errors
 * @param {Object} errors - Validation errors
 */
export function displayFormErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.form-error').forEach(el => el.remove());
  document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));

  // Display new errors
  Object.entries(errors).forEach(([field, message]) => {
    const inputId = field === 'email' ? 'trip-buddy-email' : 'trip-buddy-role';
    const input = document.getElementById(inputId);

    if (input) {
      input.classList.add('error');

      const errorDiv = document.createElement('div');
      errorDiv.className = 'form-error';
      errorDiv.textContent = message;
      errorDiv.setAttribute('role', 'alert');

      input.parentNode.appendChild(errorDiv);
    }
  });
}
