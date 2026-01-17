// Invite Trip Buddy Form Component - Form for inviting trip tripBuddys

/**
 * Create invite tripBuddy form
 * @param {string} tripId - Trip ID
 * @returns {string} HTML string
 */
export function createInviteTripBuddyForm(tripId) {
  return `
    <form id="invite-trip-buddy-form" class="form" novalidate>
      <div class="form-group">
        <label for="trip-buddy-email">Email Address *</label>
        <input
          type="email"
          id="trip-buddy-email"
          name="email"
          class="form-control"
          placeholder="colleague@example.com"
          required
          autocomplete="email"
        />
        <div class="form-hint">Enter the email address of the person you want to invite</div>
      </div>

      <div class="form-group">
        <label for="trip-buddy-role">Role *</label>
        <select
          id="trip-buddy-role"
          name="role"
          class="form-control"
          required
        >
          <option value="">Select a role...</option>
          <option value="editor">Editor - Can view and edit trip details</option>
          <option value="viewer">Viewer - Can only view trip details</option>
        </select>
        <div class="form-hint">Choose the permission level for this tripBuddy</div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn btn-sm btn-secondary"
          data-action="close-modal"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn-sm btn-primary"
        >
          Send Invitation
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
          <h2 class="modal-title" id="modal-title">Invite Trip Buddy</h2>
          <button
            type="button"
            class="modal-close"
            data-action="close-modal"
            aria-label="Close"
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
    errors.email = 'Email address is required';
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
  }

  // Validate role
  if (!role || !role.trim()) {
    errors.role = 'Role is required';
  } else if (!['editor', 'viewer'].includes(role)) {
    errors.role = 'Invalid role selected';
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
