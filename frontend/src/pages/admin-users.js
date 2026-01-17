// US8: Admin user management page - CRUD operations for all users
import { authState } from '../state/auth-state.js';
import apiClient from '../services/api-client.js';
import { app } from '../main.js';
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';
import { generatePassword } from '../utils/validators.js';
import { fetchAdminSiteConfig, updateSiteConfig } from '../services/site-config.js';
import { setSiteConfig } from '../state/site-config-state.js';

let currentPage = 0;
const PAGE_SIZE = 20;
let searchQuery = '';
let registrationEnabled = true;

/**
 * Render admin users page
 */
export async function adminUsersPage() {
  const container = document.getElementById('page-container');

  // Check authentication
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  // Check admin access
  if (!authState.isAdmin()) {
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('admin.accessDenied')}</h2>
        <p>${t('admin.adminRequired')}</p>
        <a href="#/" class="btn btn-sm btn-primary">${t('admin.backToHome')}</a>
      </div>
    `;
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>${t('admin.loadingUsers')}</p>
    </div>
  `;

  try {
    await renderUsersPage(container);
  } catch (error) {
    console.error('Failed to load users:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('admin.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <a href="#/" class="btn btn-sm btn-primary">${t('admin.backToHome')}</a>
      </div>
    `;
  }
}

/**
 * Render the users management page
 */
async function renderUsersPage(container) {
  const { users, pagination } = await fetchUsers();

  // Fetch site config for registration toggle state
  try {
    const siteConfig = await fetchAdminSiteConfig();
    registrationEnabled = siteConfig.registrationEnabled;
  } catch (error) {
    console.error('Failed to load site config:', error);
  }

  container.innerHTML = `
    <div class="admin-users-page">
      <div class="admin-users-header">
        <h1>${t('admin.manageUsers')}</h1>
        <div class="admin-users-header-actions">
          <button
            type="button"
            class="btn btn-sm ${registrationEnabled ? 'btn-success' : 'btn-secondary'} registration-toggle"
            id="registration-toggle-btn"
            title="${registrationEnabled ? t('admin.registrationEnabled') : t('admin.registrationDisabled')}"
          >
            <span class="toggle-icon">${registrationEnabled ? '&#10003;' : '&#10007;'}</span>
            ${t('admin.registration')}
          </button>
          <button type="button" class="btn btn-sm btn-primary" id="create-user-btn">
            + ${t('admin.createUser')}
          </button>
        </div>
      </div>

      <div class="admin-users-search">
        <input
          type="text"
          id="search-input"
          class="form-input"
          placeholder="${t('admin.searchPlaceholder')}"
          value="${escapeHtml(searchQuery)}"
        />
        <button type="button" class="btn btn-sm btn-secondary" id="search-btn">${t('admin.search')}</button>
        ${searchQuery ? `<button type="button" class="btn btn-sm btn-secondary" id="reset-btn">${t('admin.reset')}</button>` : ''}
      </div>

      <div class="admin-users-table-container">
        <table class="admin-users-table">
          <thead>
            <tr>
              <th>${t('admin.name')}</th>
              <th>${t('admin.email')}</th>
              <th>${t('admin.roleRequired').replace(' *', '')}</th>
              <th>${t('admin.created')}</th>
              <th>${t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            ${renderUsersRows(users)}
          </tbody>
        </table>
      </div>

      <div class="admin-users-pagination">
        <button type="button" class="btn btn-sm btn-secondary" id="prev-page-btn" ${currentPage === 0 ? 'disabled' : ''}>
          ${t('admin.previous')}
        </button>
        <span class="pagination-info">
          ${t('admin.showing', { start: pagination.offset + 1, end: Math.min(pagination.offset + users.length, pagination.total), total: pagination.total })}
        </span>
        <button type="button" class="btn btn-sm btn-secondary" id="next-page-btn" ${pagination.offset + users.length >= pagination.total ? 'disabled' : ''}>
          ${t('admin.next')}
        </button>
      </div>
    </div>

    <!-- User Modal -->
    <div id="user-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
      <div class="modal-dialog">
        <div class="modal-header">
          <h2 class="modal-title" id="user-modal-title">${t('admin.createUser')}</h2>
          <button class="modal-close" data-action="close-modal" aria-label="${t('common.close')}">&times;</button>
        </div>
        <form id="user-form" class="modal-form">
          <input type="hidden" id="user-id" name="userId" />

          <div class="form-group">
            <label for="user-fullName" class="form-label">${t('admin.fullName')}</label>
            <input
              type="text"
              id="user-fullName"
              name="fullName"
              class="form-input"
              placeholder="${t('auth.fullNamePlaceholder')}"
              maxlength="255"
            />
            <div class="form-error" data-error="fullName"></div>
          </div>

          <div class="form-group">
            <label for="user-email" class="form-label">${t('admin.emailRequired')}</label>
            <input
              type="email"
              id="user-email"
              name="email"
              class="form-input"
              placeholder="${t('admin.emailPlaceholder')}"
              required
            />
            <div class="form-error" data-error="email"></div>
          </div>

          <div class="form-group">
            <label for="user-role" class="form-label">${t('admin.roleRequired')}</label>
            <select id="user-role" name="role" class="form-select" required>
              <option value="user">${t('admin.roleUser')}</option>
              <option value="admin">${t('admin.roleAdmin')}</option>
            </select>
            <div class="form-error" data-error="role"></div>
          </div>

          <div class="form-group" id="password-group">
            <label for="user-password" class="form-label">
              <span id="password-label">${t('admin.passwordRequired')}</span>
            </label>
            <input
              type="password"
              id="user-password"
              name="password"
              class="form-input"
              placeholder="${t('admin.passwordPlaceholder')}"
              minlength="8"
            />
            <div class="form-help" id="password-requirements">${t('auth.passwordRequirements')}</div>
            <div class="form-hint" id="password-hint" style="display: none;">
              ${t('admin.passwordHint')}
            </div>
            <div class="form-error" data-error="password"></div>
          </div>

          <div class="form-group" id="confirm-password-group">
            <label for="user-confirmPassword" class="form-label">${t('auth.confirmPassword')} *</label>
            <input
              type="password"
              id="user-confirmPassword"
              name="confirmPassword"
              class="form-input"
              placeholder="${t('auth.confirmPasswordPlaceholder')}"
              minlength="8"
            />
            <div class="form-error" data-error="confirmPassword"></div>
          </div>

          <div class="generated-password-section" id="admin-generated-password-section" style="display: none;">
            <div class="generated-password-display">
              <code id="admin-generated-password-value"></code>
              <button type="button" class="btn btn-sm btn-secondary" id="admin-copy-password-btn" title="${t('auth.copyPassword')}">
                ${t('auth.copy')}
              </button>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-secondary btn-generate-password" id="admin-generate-password-btn">
            ${t('auth.generatePassword')}
          </button>

          <div class="form-error" data-error="general"></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-sm btn-secondary" data-action="close-modal">
              ${t('common.cancel')}
            </button>
            <button type="submit" class="btn btn-sm btn-primary" id="save-user-btn">
              ${t('admin.save')}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="delete-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div class="modal-dialog modal-dialog-sm">
        <div class="modal-header">
          <h2 class="modal-title" id="delete-modal-title">${t('admin.deleteUser')}</h2>
          <button class="modal-close" data-action="close-delete-modal" aria-label="${t('common.close')}">&times;</button>
        </div>
        <div class="modal-body">
          <p>${t('admin.confirmDelete')} <strong id="delete-user-name"></strong>?</p>
          <p class="text-muted">${t('admin.cannotUndo')}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm btn-secondary" data-action="close-delete-modal">
            ${t('common.cancel')}
          </button>
          <button type="button" class="btn btn-sm btn-danger" id="confirm-delete-btn">
            ${t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  `;

  attachEventListeners();
}

/**
 * Render user table rows
 */
function renderUsersRows(users) {
  if (users.length === 0) {
    return `
      <tr>
        <td colspan="5" class="text-center text-muted">${t('admin.noUsersFound')}</td>
      </tr>
    `;
  }

  const currentUserId = authState.getCurrentUser()?.id;

  return users.map((user) => `
    <tr data-user-id="${user.id}">
      <td>${escapeHtml(user.fullName || '-')}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>
        <span class="role-badge role-badge-${user.role}">${user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}</span>
      </td>
      <td>${formatDate(user.createdAt)}</td>
      <td class="actions-cell">
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-user-id="${user.id}">
          ${t('common.edit')}
        </button>
        ${user.id !== currentUserId ? `
          <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-user-id="${user.id}" data-user-name="${escapeHtml(user.email)}">
            ${t('common.delete')}
          </button>
        ` : `
          <span class="text-muted">${t('admin.you')}</span>
        `}
      </td>
    </tr>
  `).join('');
}

/**
 * Fetch users from API
 */
async function fetchUsers() {
  const offset = currentPage * PAGE_SIZE;
  const params = new URLSearchParams({
    limit: PAGE_SIZE.toString(),
    offset: offset.toString(),
  });

  if (searchQuery) {
    params.append('search', searchQuery);
  }

  return await apiClient.get(`/admin/users?${params.toString()}`);
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Create user button
  document.getElementById('create-user-btn').addEventListener('click', () => openUserModal());

  // Search
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Reset search (only exists when there's an active search)
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }

  // Pagination
  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      refreshUsersList();
    }
  });
  document.getElementById('next-page-btn').addEventListener('click', () => {
    currentPage++;
    refreshUsersList();
  });

  // Table actions
  document.getElementById('users-table-body').addEventListener('click', handleTableAction);

  // Modal close buttons
  document.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
    btn.addEventListener('click', closeUserModal);
  });
  document.querySelectorAll('[data-action="close-delete-modal"]').forEach((btn) => {
    btn.addEventListener('click', closeDeleteModal);
  });

  // Modal form submit
  document.getElementById('user-form').addEventListener('submit', handleUserFormSubmit);

  // Delete confirmation
  document.getElementById('confirm-delete-btn').addEventListener('click', handleDeleteConfirm);

  // Close modals on overlay click
  document.getElementById('user-modal').addEventListener('click', (e) => {
    if (e.target.id === 'user-modal') closeUserModal();
  });
  document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
  });

  // Generate password buttons
  document.getElementById('admin-generate-password-btn').addEventListener('click', handleGeneratePassword);
  document.getElementById('admin-copy-password-btn').addEventListener('click', handleCopyPassword);

  // Registration toggle button
  document.getElementById('registration-toggle-btn').addEventListener('click', handleRegistrationToggle);
}

/**
 * Handle search
 */
function handleSearch() {
  searchQuery = document.getElementById('search-input').value.trim();
  currentPage = 0;
  refreshUsersList();
}

/**
 * Handle search reset
 */
function handleReset() {
  searchQuery = '';
  currentPage = 0;
  refreshUsersList();
}

/**
 * Handle table action clicks (edit/delete)
 */
async function handleTableAction(e) {
  const button = e.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const userId = button.dataset.userId;

  if (action === 'edit' && userId) {
    await openEditModal(userId);
  } else if (action === 'delete' && userId) {
    openDeleteModal(userId, button.dataset.userName);
  }
}

/**
 * Open user modal for creation
 */
function openUserModal(user = null) {
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  const title = document.getElementById('user-modal-title');
  const passwordLabel = document.getElementById('password-label');
  const passwordHint = document.getElementById('password-hint');
  const passwordRequirements = document.getElementById('password-requirements');
  const passwordInput = document.getElementById('user-password');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const confirmPasswordInput = document.getElementById('user-confirmPassword');
  const generatePasswordBtn = document.getElementById('admin-generate-password-btn');
  const generatedPasswordSection = document.getElementById('admin-generated-password-section');

  form.reset();
  clearFormErrors();

  // Reset generated password section
  generatedPasswordSection.style.display = 'none';
  document.getElementById('admin-generated-password-value').textContent = '';

  if (user) {
    // Edit mode
    title.textContent = t('admin.editUser');
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-fullName').value = user.fullName || '';
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-role').value = user.role;
    passwordLabel.textContent = t('admin.newPassword');
    passwordHint.style.display = 'block';
    passwordRequirements.style.display = 'none';
    passwordInput.removeAttribute('required');
    confirmPasswordGroup.style.display = 'none';
    confirmPasswordInput.removeAttribute('required');
    generatePasswordBtn.style.display = 'none';
  } else {
    // Create mode
    title.textContent = t('admin.createUser');
    document.getElementById('user-id').value = '';
    passwordLabel.textContent = t('admin.passwordRequired');
    passwordHint.style.display = 'none';
    passwordRequirements.style.display = 'block';
    passwordInput.setAttribute('required', '');
    generatePasswordBtn.style.display = 'block';
    confirmPasswordGroup.style.display = 'block';
    confirmPasswordInput.setAttribute('required', '');
  }

  modal.classList.add('open');
}

/**
 * Open edit modal for a specific user
 */
async function openEditModal(userId) {
  try {
    const { user } = await apiClient.get(`/admin/users/${userId}`);
    openUserModal(user);
  } catch (error) {
    console.error('Failed to load user:', error);
    showToast(error.message || t('admin.loadUserFailed'), 'error');
  }
}

/**
 * Close user modal
 */
function closeUserModal() {
  document.getElementById('user-modal').classList.remove('open');
}

/**
 * Open delete confirmation modal
 */
let userToDelete = null;
function openDeleteModal(userId, userName) {
  userToDelete = userId;
  document.getElementById('delete-user-name').textContent = userName;
  document.getElementById('delete-modal').classList.add('open');
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('open');
  userToDelete = null;
}

/**
 * Handle user form submit
 */
async function handleUserFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const form = e.target;
  const formData = new FormData(form);
  const userId = formData.get('userId');
  const isEdit = !!userId;

  const userData = {
    fullName: formData.get('fullName')?.trim() || null,
    email: formData.get('email')?.trim(),
    role: formData.get('role'),
  };

  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (password) {
    userData.password = password;
  }

  // Validate
  if (!userData.email) {
    showFormError('email', t('admin.emailRequiredError'));
    return;
  }

  if (!isEdit && !password) {
    showFormError('password', t('admin.passwordRequiredError'));
    return;
  }

  // Password validation (for new users or when changing password)
  if (password) {
    if (password.length < 8) {
      showFormError('password', t('auth.passwordMinLength'));
      return;
    }

    // Check password complexity requirements
    if (!/[a-z]/.test(password)) {
      showFormError('password', t('auth.passwordNeedsLowercase'));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showFormError('password', t('auth.passwordNeedsUppercase'));
      return;
    }
    if (!/[0-9]/.test(password)) {
      showFormError('password', t('auth.passwordNeedsNumber'));
      return;
    }

    // For new users, require confirm password
    if (!isEdit) {
      if (password !== confirmPassword) {
        showFormError('confirmPassword', t('auth.passwordsMismatch'));
        return;
      }
    }
  }

  const submitBtn = document.getElementById('save-user-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = t('admin.saving');

  try {
    if (isEdit) {
      await apiClient.patch(`/admin/users/${userId}`, userData);
      showToast(t('admin.userUpdated'), 'success');
    } else {
      await apiClient.post('/admin/users', userData);
      showToast(t('admin.userCreated'), 'success');
    }

    closeUserModal();
    refreshUsersList();
  } catch (error) {
    console.error('Failed to save user:', error);
    showFormError('general', error.message || t('admin.saveFailed'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t('admin.save');
  }
}

/**
 * Handle delete confirmation
 */
async function handleDeleteConfirm() {
  if (!userToDelete) return;

  const deleteBtn = document.getElementById('confirm-delete-btn');
  deleteBtn.disabled = true;
  deleteBtn.textContent = t('admin.deleting');

  try {
    await apiClient.del(`/admin/users/${userToDelete}`);
    showToast(t('admin.userDeleted'), 'success');
    closeDeleteModal();
    refreshUsersList();
  } catch (error) {
    console.error('Failed to delete user:', error);
    showToast(error.message || t('admin.deleteFailed'), 'error');
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = t('common.delete');
  }
}

/**
 * Refresh the users list
 */
async function refreshUsersList() {
  const container = document.getElementById('page-container');
  try {
    await renderUsersPage(container);
  } catch (error) {
    console.error('Failed to refresh users:', error);
    showToast(t('admin.refreshFailed'), 'error');
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Handle generate password button click
 */
function handleGeneratePassword() {
  const password = generatePassword(16);
  const passwordInput = document.getElementById('user-password');
  const confirmPasswordInput = document.getElementById('user-confirmPassword');
  const generatedSection = document.getElementById('admin-generated-password-section');
  const generatedValue = document.getElementById('admin-generated-password-value');

  // Fill both password fields
  passwordInput.value = password;
  confirmPasswordInput.value = password;

  // Show the generated password
  generatedValue.textContent = password;
  generatedSection.style.display = 'block';

  // Clear any password errors
  const passwordError = document.querySelector('[data-error="password"]');
  const confirmError = document.querySelector('[data-error="confirmPassword"]');
  if (passwordError) {
    passwordError.textContent = '';
    passwordError.style.display = 'none';
  }
  if (confirmError) {
    confirmError.textContent = '';
    confirmError.style.display = 'none';
  }
}

/**
 * Handle copy password button click
 */
async function handleCopyPassword() {
  const generatedValue = document.getElementById('admin-generated-password-value');
  const password = generatedValue.textContent;

  try {
    await navigator.clipboard.writeText(password);
    showToast(t('auth.passwordCopied'), 'success');
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = password;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast(t('auth.passwordCopied'), 'success');
  }
}

/**
 * Handle registration toggle button click
 */
async function handleRegistrationToggle() {
  const btn = document.getElementById('registration-toggle-btn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;

  try {
    const newValue = !registrationEnabled;
    await updateSiteConfig({ registrationEnabled: newValue });
    registrationEnabled = newValue;

    // Update button appearance
    btn.classList.remove(registrationEnabled ? 'btn-secondary' : 'btn-success');
    btn.classList.add(registrationEnabled ? 'btn-success' : 'btn-secondary');
    btn.title = registrationEnabled ? t('admin.registrationEnabled') : t('admin.registrationDisabled');
    btn.innerHTML = `
      <span class="toggle-icon">${registrationEnabled ? '&#10003;' : '&#10007;'}</span>
      ${t('admin.registration')}
    `;

    showToast(
      registrationEnabled ? t('admin.registrationEnabledMessage') : t('admin.registrationDisabledMessage'),
      'success'
    );

    // Update site config state to reflect change in nav
    setSiteConfig({ registrationEnabled });
  } catch (error) {
    console.error('Failed to toggle registration:', error);
    showToast(t('admin.registrationToggleFailed'), 'error');
    btn.innerHTML = originalHTML;
  } finally {
    btn.disabled = false;
  }
}
