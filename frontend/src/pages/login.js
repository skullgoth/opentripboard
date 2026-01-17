// Login page
import { authState } from '../state/auth-state.js';
import { app } from '../main.js';
import { t } from '../utils/i18n.js';
import { isRegistrationEnabled } from '../state/site-config-state.js';

/**
 * Render login page
 */
export async function loginPage() {
  const container = document.getElementById('page-container');

  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-container">
        <h1>${t('auth.loginTitle')}</h1>
        <form id="login-form" class="auth-form">
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
              placeholder="${t('auth.passwordPlaceholder')}"
              required
              autocomplete="current-password"
            />
            <div class="form-error" data-error="password"></div>
          </div>

          <div class="form-error" data-error="general"></div>

          <button type="button" class="btn btn-sm btn-primary btn-lg" id="login-btn">
            ${t('auth.login')}
          </button>
        </form>

        ${isRegistrationEnabled() ? `
        <p class="auth-footer">
          ${t('auth.noAccount')} <a href="#/register">${t('auth.register')}</a>
        </p>
        ` : ''}
      </div>
    </div>
  `;

  // Attach form and button listeners
  const form = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');

  form.addEventListener('submit', handleLogin);
  loginBtn.addEventListener('click', handleLogin);
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();

  // Clear previous errors
  clearFormErrors();

  // Get form element (either from submit event or find it from button click)
  const form = e.target.tagName === 'FORM' ? e.target : document.getElementById('login-form');
  const formData = new FormData(form);
  const email = formData.get('email');
  const password = formData.get('password');

  // Validate
  if (!email || !password) {
    showFormError('general', t('auth.fillAllFields'));
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById('login-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('auth.loggingIn');

  try {
    // Login via auth state
    await authState.login(email, password);

    // Navigate to home on success
    app.router.navigate('/');
  } catch (error) {
    console.error('Login failed:', error);

    // Show user-friendly error message
    const errorMessage = error.message && error.message.includes('Invalid email or password')
      ? t('auth.invalidCredentials')
      : (error.message || t('auth.invalidCredentials'));

    showFormError('general', errorMessage);

    // Restore button state
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
