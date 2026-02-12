// US8: Profile page - users can view and update their profile
import { authState } from '../state/auth-state.js';
import apiClient from '../services/api-client.js';
import { app } from '../main.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Render profile page
 */
export async function profilePage() {
  const container = document.getElementById('page-container');

  // Check authentication
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  const user = authState.getCurrentUser();

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-container">
        <h1>Your Profile</h1>

        <div class="profile-section">
          <h2>Account Information</h2>
          <form id="profile-form" class="profile-form">
            <div class="form-group">
              <label for="fullName" class="form-label">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                class="form-input"
                placeholder="Your full name"
                value="${escapeHtml(user.fullName || '')}"
                maxlength="255"
              />
              <div class="form-error" data-error="fullName"></div>
            </div>

            <div class="form-group">
              <label for="email" class="form-label">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                class="form-input"
                placeholder="your.email@example.com"
                value="${escapeHtml(user.email || '')}"
                required
                autocomplete="email"
              />
              <div class="form-error" data-error="email"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Role</label>
              <div class="form-static">
                <span class="role-badge role-badge-${user.role || 'user'}">${user.role || 'user'}</span>
              </div>
            </div>

            <div class="form-error" data-error="profile-general"></div>

            <button type="submit" class="btn btn-sm btn-primary" id="save-profile-btn">
              Save Changes
            </button>
          </form>
        </div>

        <div class="profile-section">
          <h2>Change Password</h2>
          <form id="password-form" class="profile-form">
            <div class="form-group">
              <label for="currentPassword" class="form-label">Current Password *</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                class="form-input"
                placeholder="Enter current password"
                required
                autocomplete="current-password"
              />
              <div class="form-error" data-error="currentPassword"></div>
            </div>

            <div class="form-group">
              <label for="newPassword" class="form-label">New Password *</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                class="form-input"
                placeholder="Enter new password (min 8 characters)"
                required
                minlength="8"
                autocomplete="new-password"
              />
              <div class="form-error" data-error="newPassword"></div>
            </div>

            <div class="form-group">
              <label for="confirmPassword" class="form-label">Confirm New Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                class="form-input"
                placeholder="Confirm new password"
                required
                minlength="8"
                autocomplete="new-password"
              />
              <div class="form-error" data-error="confirmPassword"></div>
            </div>

            <div class="form-error" data-error="password-general"></div>

            <button type="submit" class="btn btn-sm btn-primary" id="change-password-btn">
              Change Password
            </button>
          </form>
        </div>

        <div class="profile-section profile-section-meta">
          <p class="profile-meta">Account created: ${formatDate(user.createdAt)}</p>
        </div>
      </div>
    </div>
  `;

  // Attach form listeners
  document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
  document.getElementById('password-form').addEventListener('submit', handlePasswordChange);
}

/**
 * Handle profile update form submission
 */
async function handleProfileUpdate(e) {
  e.preventDefault();
  clearFormErrors();

  const form = e.target;
  const formData = new FormData(form);
  const fullName = formData.get('fullName')?.trim();
  const email = formData.get('email')?.trim();

  // Validate email
  if (!email) {
    showFormError('email', 'Email is required');
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById('save-profile-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const response = await apiClient.patch('/users/profile', {
      fullName: fullName || null,
      email,
    });

    // Update local state
    authState.updateCurrentUser(response.user);

    showToast('Profile updated successfully', 'success');
  } catch (error) {
    console.error('Profile update failed:', error);
    showFormError('profile-general', error.message || 'Failed to update profile');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Handle password change form submission
 */
async function handlePasswordChange(e) {
  e.preventDefault();
  clearFormErrors();

  const form = e.target;
  const formData = new FormData(form);
  const currentPassword = formData.get('currentPassword');
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');

  // Validate
  if (!currentPassword || !newPassword || !confirmPassword) {
    showFormError('password-general', 'All password fields are required');
    return;
  }

  if (newPassword.length < 8) {
    showFormError('newPassword', 'Password must be at least 8 characters');
    return;
  }

  if (newPassword !== confirmPassword) {
    showFormError('confirmPassword', 'Passwords do not match');
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById('change-password-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Changing...';

  try {
    await apiClient.post('/users/profile/password', {
      currentPassword,
      newPassword,
    });

    showToast('Password changed successfully', 'success');

    // Clear form
    form.reset();
  } catch (error) {
    console.error('Password change failed:', error);
    showFormError('password-general', error.message || 'Failed to change password');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Show form error
 */
function showFormError(field, message) {
  const errorEl = document.querySelector(`[data-error="${field}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

/**
 * Clear all form errors
 */
function clearFormErrors() {
  document.querySelectorAll('.form-error').forEach((el) => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
