// T042: Application entry point - routing and initialization
// US8: Extended with profile and admin user management
// US9: Extended with shared trip view
// T300: Added global error boundary
import { getItem, setItem } from './utils/storage.js';
import { homePage } from './pages/home.js';
import { tripDetailPage, cleanupTripDetailPage } from './pages/trip-detail.js';
import { budgetPage, cleanupBudgetPage } from './pages/budget.js';
import { listsPage, cleanupListsPage } from './pages/lists.js';
import { documentsPage, cleanupDocumentsPage } from './pages/documents.js';
import { loginPage } from './pages/login.js';
import { registerPage } from './pages/register.js';
import { invitationsPage } from './pages/invitations.js';
import { profilePage } from './pages/profile.js';
import { adminUsersPage } from './pages/admin-users.js';
import { sharedTripPage } from './pages/shared-trip.js';
import { settingsPage } from './pages/settings.js';
import { authState } from './state/auth-state.js';
import { tripState } from './state/trip-state.js';
import { preferencesState, setPreferences, setPreferencesLoading } from './state/preferences-state.js';
import router from './utils/router.js';
import apiClient from './services/api-client.js';
import { fetchPreferences, savePreferences } from './services/preferences.js';
import { getDefaultPreferences } from './utils/locale-detection.js';
import { initTheme, toggleTheme, updateThemeIcon, watchOSThemeChange } from './utils/theme.js';
import { initErrorBoundary } from './utils/error-boundary.js';
import { registerServiceWorker, addServiceWorkerStyles } from './utils/service-worker.js';
import { initI18n, setLanguage, t, onLanguageChange } from './utils/i18n.js';
import { setSiteConfig, isRegistrationEnabled, subscribeToSiteConfig } from './state/site-config-state.js';
import { fetchPublicSiteConfig } from './services/site-config.js';

/**
 * Application state
 */
const app = {
  router,
  user: null,
  websocket: null,
};

/**
 * Generate avatar color based on name/email
 * @param {string} str - Name or email
 * @returns {string} CSS color value
 */
function getAvatarColor(str) {
  if (!str) return '#6c757d';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107',
    '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14',
  ];

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from name or email (for compact list)
 * @param {string} nameOrEmail - Name or email
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '?';

  // If it's an email, use first letter before @
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.charAt(0).toUpperCase();
  }

  // Otherwise, get first letter of each word
  const words = nameOrEmail.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Load user preferences from the API
 */
async function loadUserPreferences() {
  if (!authState.isAuthenticated()) {
    return;
  }

  try {
    setPreferencesLoading(true);
    const preferences = await fetchPreferences();

    // Check if user has never set preferences (first login)
    if (preferences.isDefault) {
      // Use browser-detected defaults and save them to the user's account
      const browserDefaults = getDefaultPreferences();

      // Save browser defaults to the server
      try {
        await savePreferences(browserDefaults);
        setPreferences(browserDefaults);
        await initI18n(browserDefaults.language);
      } catch (saveError) {
        console.warn('[Preferences] Failed to save browser defaults:', saveError);
        // Fall back to browser defaults locally
        setPreferences(browserDefaults);
        await initI18n(browserDefaults.language);
      }
    } else {
      // User has explicit preferences, use them
      const { isDefault, ...userPrefs } = preferences;
      setPreferences(userPrefs);
      await initI18n(userPrefs.language);
    }
  } catch (error) {
    console.error('[Preferences] Failed to load preferences:', error);
    // Keep using browser defaults if API fails
    const defaults = getDefaultPreferences();
    setPreferences(defaults);
    await initI18n(defaults.language);
  } finally {
    setPreferencesLoading(false);
  }
}

/**
 * Load site configuration (public settings)
 */
async function loadSiteConfig() {
  try {
    const config = await fetchPublicSiteConfig();
    setSiteConfig(config);
  } catch (error) {
    console.error('[SiteConfig] Failed to load site config:', error);
    // Default to registration enabled on error
    setSiteConfig({ registrationEnabled: true });
  }
}

/**
 * Initialize application (T080: Auth state integration)
 */
async function initApp() {
  // Initialize global error boundary first
  initErrorBoundary();

  // Initialize theme before anything else to prevent flash
  const currentTheme = initTheme();

  // Load site configuration (needed for registration check)
  await loadSiteConfig();

  // Subscribe to site config changes to update nav
  subscribeToSiteConfig(() => {
    updateUIForAuthState(authState.isAuthenticated());
  });

  // Expose apiClient for e2e tests
  if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
  }

  // Load authentication state from storage
  // Auth state is already loaded in authState constructor
  app.user = authState.getCurrentUser();

  // Subscribe to auth state changes
  authState.subscribe(async (user) => {
    app.user = user;
    updateUIForAuthState(!!user);

    // Clear trip state when user logs out
    if (!user) {
      tripState.clear();
      // Reset preferences to browser defaults when logged out
      const defaults = getDefaultPreferences();
      setPreferences(defaults);
      // Reset i18n to browser locale
      await initI18n(defaults.language);
    } else {
      // Load user preferences when logged in
      await loadUserPreferences();
    }
  });

  // Load preferences on initial load
  if (authState.isAuthenticated()) {
    await loadUserPreferences();
  } else {
    // Apply browser locale defaults for unauthenticated users
    const defaults = getDefaultPreferences();
    setPreferences(defaults);
    // Initialize i18n with browser locale language
    await initI18n(defaults.language);
  }

  // Update UI based on initial auth state
  updateUIForAuthState(authState.isAuthenticated());

  // Re-render navigation when language changes
  onLanguageChange(() => {
    updateUIForAuthState(authState.isAuthenticated());
  });

  // Add router hook to cleanup when leaving pages
  app.router.beforeEach((to, from) => {
    // Check if we're leaving a trip detail page
    if (from && from.startsWith('/trips/') && !from.includes('/budget')) {
      cleanupTripDetailPage();
    }
    // Check if we're leaving a budget page
    if (from && from.includes('/budget')) {
      cleanupBudgetPage();
    }
    // Check if we're leaving a lists page
    if (from && from.includes('/lists')) {
      cleanupListsPage();
    }
    // Check if we're leaving a documents page
    if (from && from.includes('/documents')) {
      cleanupDocumentsPage();
    }
    return true; // Allow navigation to continue
  });

  // Cleanup when page is unloaded (browser tab closed, navigation away, etc.)
  window.addEventListener('beforeunload', () => {
    const currentRoute = app.router.getCurrentRoute();
    if (currentRoute && currentRoute.startsWith('/trips/')) {
      cleanupTripDetailPage();
    }
  });

  // Register routes
  app.router.addRoute('/', homePage);
  app.router.addRoute('/login', loginPage);
  app.router.addRoute('/register', registerPage);
  app.router.addRoute('/invitations', invitationsPage);
  app.router.addRoute('/profile', profilePage);
  app.router.addRoute('/admin/users', adminUsersPage);
  app.router.addRoute('/settings', settingsPage);
  app.router.addRoute('/shared/:token', (params) => sharedTripPage(params.token));
  app.router.addRoute('/trips/:id', tripDetailPage);
  app.router.addRoute('/trips/:id/budget', budgetPage);
  app.router.addRoute('/trips/:id/lists', listsPage);
  app.router.addRoute('/trips/:id/documents', documentsPage);

  // Start router after all routes are registered
  app.router.start();

  // Watch for OS theme changes (only affects UI if no cookie preference set)
  watchOSThemeChange((newTheme) => {
    updateThemeIcon(newTheme);
  });

  // Register service worker for offline support (production only by default)
  addServiceWorkerStyles();
  registerServiceWorker().then((registration) => {
    if (registration) {
      console.log('Service worker registered for offline support');
    }
  });
}

/**
 * Update UI based on authentication state
 */
function updateUIForAuthState(isAuthenticated) {
  const nav = document.getElementById('main-nav');
  const userMenu = document.getElementById('user-menu');

  if (isAuthenticated) {
    nav.innerHTML = `
      <a href="#/">${t('nav.myTrips')}</a>
      <a href="#/invitations" class="nav-link-with-badge">
        ${t('nav.invitations')}
        <span id="invitation-badge" class="notification-badge hidden">0</span>
      </a>
    `;

    userMenu.innerHTML = `
      <div class="user-info">
        <button id="theme-toggle" class="btn btn-sm btn-secondary" aria-label="Toggle theme">
          <span id="theme-icon">🌙</span>
        </button>
        <div class="avatar-menu-container">
          <button
            id="avatar-badge"
            class="user-avatar"
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded="false"
            style="background-color: ${getAvatarColor(app.user?.email)}">
            ${getInitials(app.user?.email)}
          </button>
          <div id="avatar-dropdown" class="avatar-dropdown hidden">
            <a href="#/profile" class="dropdown-item" data-testid="profile-link">
              <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              ${t('nav.profile')}
            </a>
            <a href="#/settings" class="dropdown-item" data-testid="settings-link">
              <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              ${t('nav.settings')}
            </a>
            ${authState.isAdmin() ? `
            <a href="#/admin/users" class="dropdown-item" data-testid="admin-users-link">
              <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ${t('nav.manageUsers')}
            </a>
            ` : ''}
            <div class="dropdown-divider"></div>
            <button id="logout-btn" data-testid="logout-button" class="dropdown-item">
              <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              ${t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    `;

    // Setup avatar menu dropdown
    setupAvatarMenu();

    // Setup theme toggle button
    setupThemeToggle();

    // Start polling for invitation count
    updateInvitationCount();
    startInvitationCountPolling();
  } else {
    nav.innerHTML = '';

    // Only show Register button if registration is enabled
    const registrationEnabled = isRegistrationEnabled();

    userMenu.innerHTML = `
      <button id="theme-toggle" class="btn btn-sm btn-secondary" aria-label="Toggle theme">
        <span id="theme-icon">🌙</span>
      </button>
      <a href="#/login" class="btn btn-sm btn-secondary">${t('auth.login')}</a>
      ${registrationEnabled ? `<a href="#/register" class="btn btn-sm btn-primary">${t('auth.register')}</a>` : ''}
    `;

    // Setup theme toggle button
    setupThemeToggle();

    // Stop polling when logged out
    stopInvitationCountPolling();
  }
}

/**
 * Setup theme toggle button
 */
function setupThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    // Update icon based on current theme
    import('./utils/theme.js').then(({ getCurrentTheme, updateThemeIcon }) => {
      const currentTheme = getCurrentTheme();
      updateThemeIcon(currentTheme);
    });

    // Add click handler
    themeToggleBtn.addEventListener('click', () => {
      const newTheme = toggleTheme();
      updateThemeIcon(newTheme);
    });
  }
}

/**
 * Setup avatar menu dropdown (T332-T335: US12)
 */
function setupAvatarMenu() {
  const avatarBadge = document.getElementById('avatar-badge');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  const logoutBtn = document.getElementById('logout-btn');

  if (!avatarBadge || !avatarDropdown || !logoutBtn) return;

  // Toggle dropdown when avatar is clicked
  avatarBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = avatarDropdown.classList.contains('hidden');

    if (isHidden) {
      avatarDropdown.classList.remove('hidden');
      avatarBadge.setAttribute('aria-expanded', 'true');
    } else {
      avatarDropdown.classList.add('hidden');
      avatarBadge.setAttribute('aria-expanded', 'false');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!avatarBadge.contains(e.target) && !avatarDropdown.contains(e.target)) {
      avatarDropdown.classList.add('hidden');
      avatarBadge.setAttribute('aria-expanded', 'false');
    }
  });

  // Handle logout button click
  logoutBtn.addEventListener('click', () => {
    avatarDropdown.classList.add('hidden');
    avatarBadge.setAttribute('aria-expanded', 'false');
    handleLogout();
  });
}

/**
 * Handle logout (T080: Auth state integration)
 */
function handleLogout() {
  // Use auth state to handle logout
  authState.logout();

  // Close websocket if open
  if (app.websocket) {
    app.websocket.close();
    app.websocket = null;
  }

  // Navigate to login
  app.router.navigate('/login');
}

/**
 * Update invitation count badge
 */
async function updateInvitationCount() {
  if (!authState.isAuthenticated()) return;

  try {
    const invitations = await apiClient.get('/trip-buddies/invitations');
    const count = invitations?.length || 0;

    const badge = document.getElementById('invitation-badge');
    if (badge) {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Failed to fetch invitation count:', error);
  }
}

/**
 * Start polling for invitation count updates
 */
let invitationCountInterval = null;

function startInvitationCountPolling() {
  // Clear any existing interval
  stopInvitationCountPolling();

  // Poll every 30 seconds
  invitationCountInterval = setInterval(updateInvitationCount, 30000);
}

function stopInvitationCountPolling() {
  if (invitationCountInterval) {
    clearInterval(invitationCountInterval);
    invitationCountInterval = null;
  }
}

// Export for use in other modules
export { app, updateInvitationCount };

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
