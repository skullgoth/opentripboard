// Register page
import { authState } from '../state/auth-state.js';
import { app } from '../main.js';
import { t } from '../utils/i18n.js';
import { generatePassword } from '../utils/validators.js';
import { showToast } from '../utils/toast.js';
import { isRegistrationEnabled } from '../state/site-config-state.js';

/**
 * Render register page
 */
export async function registerPage() {
  const container = document.getElementById('page-container');

  // Check if registration is enabled
  if (!isRegistrationEnabled()) {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-container">
          <h1>${t('auth.registrationClosed')}</h1>
          <p class="registration-closed-message">${t('auth.registrationClosedMessage')}</p>
          <a href="#/login" class="btn btn-primary">${t('auth.login')}</a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <h1>${t('auth.registerTitle')}</h1>
        <form id="register-form" class="auth-form">
          <div class="form-group">
            <label for="fullName" class="form-label">${t('auth.fullName')}</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              class="form-input"
              placeholder="${t('auth.fullNamePlaceholder')}"
              maxlength="255"
            />
            <div class="form-error" data-error="fullName"></div>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">${t('auth.email')} *</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-input"
              placeholder="${t('auth.emailPlaceholder')}"
              required
              autocomplete="email"
            />
            <div class="form-error" data-error="email"></div>
          </div>

          <div class="form-group">
            <label for="password" class="form-label">${t('auth.password')} *</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="${t('auth.passwordMinChars')}"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <div class="form-help">${t('auth.passwordRequirements')}</div>
            <div class="form-error" data-error="password"></div>
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">${t('auth.confirmPassword')} *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              class="form-input"
              placeholder="${t('auth.confirmPasswordPlaceholder')}"
              required
              minlength="8"
              autocomplete="new-password"
            />
            <div class="form-error" data-error="confirmPassword"></div>
          </div>

          <div class="generated-password-section" id="generated-password-section" style="display: none;">
            <div class="generated-password-display">
              <code id="generated-password-value"></code>
              <button type="button" class="btn btn-sm btn-secondary" id="copy-password-btn" title="${t('auth.copyPassword')}">
                ${t('auth.copy')}
              </button>
            </div>
          </div>

          <button type="button" class="btn btn-sm btn-secondary btn-generate-password" id="generate-password-btn">
            ${t('auth.generatePassword')}
          </button>

          <div class="form-error" data-error="general"></div>

          <button type="submit" class="btn btn-sm btn-primary btn-lg" id="register-btn">
            ${t('auth.registerButton')}
          </button>
        </form>

        <p class="auth-footer">
          ${t('auth.hasAccount')} <a href="#/login">${t('auth.login')}</a>
        </p>
      </div>
    </div>
  `;

  // Attach form listener
  const form = document.getElementById('register-form');
  form.addEventListener('submit', handleRegister);

  // Attach generate password listener
  document.getElementById('generate-password-btn').addEventListener('click', handleGeneratePassword);
  document.getElementById('copy-password-btn').addEventListener('click', handleCopyPassword);
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
  e.preventDefault();

  // Clear previous errors
  clearFormErrors();

  const formData = new FormData(e.target);
  const fullName = formData.get('fullName')?.trim() || null;
  const email = formData.get('email')?.trim();
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  // Validate
  const errors = validateRegistration({ email, password, confirmPassword });
  if (errors.length > 0) {
    errors.forEach(({ field, message }) => showFormError(field, message));
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById('register-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('auth.registering');

  try {
    // Register via auth state
    await authState.register({
      fullName,
      email,
      password,
    });

    // Navigate to home on success
    app.router.navigate('/');
  } catch (error) {
    console.error('Registration failed:', error);
    showFormError('general', error.message || t('auth.registrationFailed'));

    // Restore button state
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

/**
 * Validate registration data
 */
function validateRegistration({ email, password, confirmPassword }) {
  const errors = [];

  if (!email || email.length === 0) {
    errors.push({ field: 'email', message: t('auth.emailRequired') });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: t('auth.emailInvalid') });
  }

  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: t('auth.passwordMinLength') });
  } else {
    // Check password strength requirements
    if (!/[a-z]/.test(password)) {
      errors.push({ field: 'password', message: t('auth.passwordNeedsLowercase') });
    }
    if (!/[A-Z]/.test(password)) {
      errors.push({ field: 'password', message: t('auth.passwordNeedsUppercase') });
    }
    if (!/[0-9]/.test(password)) {
      errors.push({ field: 'password', message: t('auth.passwordNeedsNumber') });
    }
  }

  if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: t('auth.passwordsMismatch') });
  }

  return errors;
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
 * Handle generate password button click
 */
function handleGeneratePassword() {
  const password = generatePassword(16);
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const generatedSection = document.getElementById('generated-password-section');
  const generatedValue = document.getElementById('generated-password-value');

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
  const generatedValue = document.getElementById('generated-password-value');
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
