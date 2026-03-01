// Settings page for user preferences
// US1: Configure display preferences (date, time, distance formats)
// US2: Language preference
// US3: View current preferences
// US4: Trip Categories management

import { authState } from '../state/auth-state.js';
import { preferencesState, getPreferences, setPreferences, isPreferencesLoading } from '../state/preferences-state.js';
import { savePreferences, fetchSupportedLanguages } from '../services/preferences.js';
import { getFormatExamples } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import router from '../utils/router.js';
import { setLanguage, t } from '../utils/i18n.js';
import { getDefaultPreferences } from '../utils/locale-detection.js';
import { createCategoryManager } from '../components/category-manager.js';
import { logError } from '../utils/error-tracking.js';

// Category manager instance
let categoryManagerInstance = null;

/**
 * Settings page component
 */
export async function settingsPage() {
  const container = document.getElementById('page-container');

  // Check authentication
  if (!authState.isAuthenticated()) {
    // Store return URL and redirect to login
    sessionStorage.setItem('returnUrl', '/settings');
    router.navigate('/login');
    return;
  }

  // Show loading state if preferences are still being fetched
  if (isPreferencesLoading()) {
    container.innerHTML = `
      <div class="settings-page">
        <header class="page-header">
          <h1>${t('settings.title')}</h1>
          <p class="page-subtitle">${t('settings.subtitle')}</p>
        </header>
        <div class="settings-loading">
          <div class="loading-spinner"></div>
          <p>${t('settings.loading')}</p>
        </div>
      </div>
    `;
    return;
  }

  // Get current preferences
  const preferences = getPreferences();

  // Check if preferences are default (unchanged)
  const defaults = getDefaultPreferences();
  const isUsingDefaults =
    preferences.dateFormat === defaults.dateFormat &&
    preferences.timeFormat === defaults.timeFormat &&
    preferences.distanceFormat === defaults.distanceFormat &&
    preferences.language === defaults.language;

  // Language display names
  const languageNames = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
  };

  // Render the page
  container.innerHTML = `
    <div class="settings-page">
      <header class="page-header">
        <h1>${t('settings.title')}</h1>
        <p class="page-subtitle">${t('settings.subtitle')}</p>
      </header>

      <div class="settings-content">
        <!-- Current Preferences Preview -->
        <section class="settings-section" id="preferences-preview">
          <div class="section-header-row">
            <h2>${t('settings.currentSettings')}</h2>
            ${isUsingDefaults ? `<span class="default-badge" title="${t('settings.default')}">${t('settings.default')}</span>` : ''}
          </div>
          <div class="preview-card">
            <div class="preview-item">
              <span class="preview-label">${t('settings.date')}</span>
              <span class="preview-value" id="preview-date"></span>
            </div>
            <div class="preview-item">
              <span class="preview-label">${t('settings.time')}</span>
              <span class="preview-value" id="preview-time"></span>
            </div>
            <div class="preview-item">
              <span class="preview-label">${t('settings.distanceLabel')}</span>
              <span class="preview-value" id="preview-distance"></span>
            </div>
            <div class="preview-item">
              <span class="preview-label">${t('settings.languageLabel')}</span>
              <span class="preview-value" id="preview-language">${languageNames[preferences.language] || preferences.language}</span>
            </div>
          </div>
        </section>

        <!-- Display Format Settings -->
        <section class="settings-section">
          <h2>${t('settings.displayFormats')}</h2>

          <!-- Date Format -->
          <div class="setting-group">
            <label class="setting-label">${t('settings.dateFormat')}</label>
            <div class="toggle-group" role="radiogroup" aria-label="${t('settings.dateFormat')}">
              <button
                type="button"
                class="toggle-btn ${preferences.dateFormat === 'mdy' ? 'active' : ''}"
                data-setting="dateFormat"
                data-value="mdy"
                role="radio"
                aria-checked="${preferences.dateFormat === 'mdy'}"
              >
                <span class="toggle-example">3/21</span>
                <span class="toggle-label">${t('settings.monthDay')}</span>
              </button>
              <button
                type="button"
                class="toggle-btn ${preferences.dateFormat === 'dmy' ? 'active' : ''}"
                data-setting="dateFormat"
                data-value="dmy"
                role="radio"
                aria-checked="${preferences.dateFormat === 'dmy'}"
              >
                <span class="toggle-example">21/3</span>
                <span class="toggle-label">${t('settings.dayMonth')}</span>
              </button>
            </div>
          </div>

          <!-- Time Format -->
          <div class="setting-group">
            <label class="setting-label">${t('settings.timeFormat')}</label>
            <div class="toggle-group" role="radiogroup" aria-label="${t('settings.timeFormat')}">
              <button
                type="button"
                class="toggle-btn ${preferences.timeFormat === '12h' ? 'active' : ''}"
                data-setting="timeFormat"
                data-value="12h"
                role="radio"
                aria-checked="${preferences.timeFormat === '12h'}"
              >
                <span class="toggle-example">2:00 PM</span>
                <span class="toggle-label">${t('settings.hour12')}</span>
              </button>
              <button
                type="button"
                class="toggle-btn ${preferences.timeFormat === '24h' ? 'active' : ''}"
                data-setting="timeFormat"
                data-value="24h"
                role="radio"
                aria-checked="${preferences.timeFormat === '24h'}"
              >
                <span class="toggle-example">14:00</span>
                <span class="toggle-label">${t('settings.hour24')}</span>
              </button>
            </div>
          </div>

          <!-- Distance Format -->
          <div class="setting-group">
            <label class="setting-label">${t('settings.distanceFormat')}</label>
            <div class="toggle-group" role="radiogroup" aria-label="${t('settings.distanceFormat')}">
              <button
                type="button"
                class="toggle-btn ${preferences.distanceFormat === 'mi' ? 'active' : ''}"
                data-setting="distanceFormat"
                data-value="mi"
                role="radio"
                aria-checked="${preferences.distanceFormat === 'mi'}"
              >
                <span class="toggle-example">50 mi</span>
                <span class="toggle-label">${t('settings.miles')}</span>
              </button>
              <button
                type="button"
                class="toggle-btn ${preferences.distanceFormat === 'km' ? 'active' : ''}"
                data-setting="distanceFormat"
                data-value="km"
                role="radio"
                aria-checked="${preferences.distanceFormat === 'km'}"
              >
                <span class="toggle-example">80 km</span>
                <span class="toggle-label">${t('settings.kilometers')}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Language Settings -->
        <section class="settings-section" id="language-section">
          <h2>${t('settings.language')}</h2>
          <div class="setting-group">
            <label class="setting-label" for="language-select">${t('settings.interfaceLanguage')}</label>
            <select id="language-select" class="form-select" aria-label="${t('settings.interfaceLanguage')}">
              <option value="en" ${preferences.language === 'en' ? 'selected' : ''}>English</option>
              <option value="fr" ${preferences.language === 'fr' ? 'selected' : ''}>Français</option>
              <option value="es" ${preferences.language === 'es' ? 'selected' : ''}>Español</option>
            </select>
          </div>
        </section>

        <!-- Trip Categories Section -->
        <section class="settings-section" id="trip-categories-section">
          <div id="category-manager-container"></div>
        </section>
      </div>
    </div>
  `;

  // Update preview
  updatePreview(preferences);

  // Setup event listeners
  setupSettingsListeners();

  // Initialize category manager
  initCategoryManager();
}

/**
 * Initialize the category manager component
 */
function initCategoryManager() {
  // Clean up existing instance
  if (categoryManagerInstance) {
    categoryManagerInstance.destroy();
    categoryManagerInstance = null;
  }

  const container = document.getElementById('category-manager-container');
  if (container) {
    categoryManagerInstance = createCategoryManager(container);
  }
}

/**
 * Update the preview section with formatted examples
 * @param {Object} prefs - Current preferences
 */
function updatePreview(prefs) {
  const examples = getFormatExamples(prefs);

  const dateEl = document.getElementById('preview-date');
  const timeEl = document.getElementById('preview-time');
  const distanceEl = document.getElementById('preview-distance');

  if (dateEl) dateEl.textContent = examples.dateWithYear;
  if (timeEl) timeEl.textContent = examples.time;
  if (distanceEl) distanceEl.textContent = examples.distance;
}

/**
 * Setup event listeners for settings controls
 */
function setupSettingsListeners() {
  // Toggle buttons for format settings
  document.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const setting = btn.dataset.setting;
      const value = btn.dataset.value;

      await handleSettingChange(setting, value);
    });
  });

  // Language select
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    languageSelect.addEventListener('change', async (e) => {
      await handleSettingChange('language', e.target.value);
    });
  }
}

/**
 * Handle a setting change with optimistic UI update
 * @param {string} setting - Setting name
 * @param {string} value - New value
 */
async function handleSettingChange(setting, value) {
  const oldPreferences = getPreferences();
  const newPreferences = { ...oldPreferences, [setting]: value };

  // Optimistic UI update
  setPreferences(newPreferences);
  updateToggleUI(setting, value);
  updatePreview(newPreferences);

  // Update i18n language if language changed
  if (setting === 'language') {
    await setLanguage(value);
  }

  try {
    // Save to server
    await savePreferences({ [setting]: value });
    showToast(t('settings.preferencesSaved'), 'success');
  } catch (error) {
    // Rollback on error
    logError('[Settings] Failed to save preferences:', error);
    setPreferences(oldPreferences);
    updateToggleUI(setting, oldPreferences[setting]);
    updatePreview(oldPreferences);

    // Rollback language if it was changed
    if (setting === 'language') {
      await setLanguage(oldPreferences.language);
    }

    showToast(t('settings.preferencesSaveFailed'), 'error');
  }
}

/**
 * Update toggle button UI to reflect current selection
 * @param {string} setting - Setting name
 * @param {string} value - Current value
 */
function updateToggleUI(setting, value) {
  const buttons = document.querySelectorAll(`[data-setting="${setting}"]`);
  buttons.forEach((btn) => {
    const isActive = btn.dataset.value === value;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive);
  });
}

export default settingsPage;
