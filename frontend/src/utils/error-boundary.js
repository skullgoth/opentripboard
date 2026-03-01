// T300: Global error boundary for frontend error handling
// T303: Integrated with error tracking (Sentry)

import { captureError, initErrorTracking, logError } from './error-tracking.js';
import { t } from './i18n.js';

/**
 * Global error state
 */
let lastError = null;
let errorCallback = null;

/**
 * Initialize global error boundary
 * Sets up window error handlers and unhandled rejection handlers
 */
export function initErrorBoundary() {
  // Initialize error tracking (Sentry or fallback)
  initErrorTracking().catch(() => {
    // Error tracking initialization failed, continue without it
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    handleError({
      type: 'uncaught',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError({
      type: 'unhandledrejection',
      message: event.reason?.message || String(event.reason),
      error: event.reason,
    });
  });
}

/**
 * Handle an error
 * @param {Object} errorInfo - Error information
 */
function handleError(errorInfo) {
  lastError = {
    ...errorInfo,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // Log to console
  logError('Global error caught:', lastError);

  // Send to error tracking service (Sentry or fallback)
  captureError(errorInfo.error || new Error(errorInfo.message), {
    type: errorInfo.type,
    filename: errorInfo.filename,
    lineno: errorInfo.lineno,
    colno: errorInfo.colno,
    functionName: errorInfo.functionName,
  });

  // Call registered callback
  if (errorCallback) {
    try {
      errorCallback(lastError);
    } catch (callbackError) {
      logError('Error in error callback:', callbackError);
    }
  }

  // Show error UI if it's a critical error
  if (errorInfo.type === 'uncaught' || errorInfo.type === 'unhandledrejection') {
    showErrorUI(lastError);
  }
}

/**
 * Register an error callback
 * @param {Function} callback - Function to call when an error occurs
 */
export function onError(callback) {
  errorCallback = callback;
}

/**
 * Get the last error
 * @returns {Object|null} Last error information
 */
export function getLastError() {
  return lastError;
}

/**
 * Clear the last error
 */
export function clearLastError() {
  lastError = null;
  hideErrorUI();
}

/**
 * Show error UI overlay
 * @param {Object} errorInfo - Error information
 */
function showErrorUI(errorInfo) {
  // Check if error UI already exists
  let errorOverlay = document.getElementById('global-error-overlay');

  if (!errorOverlay) {
    errorOverlay = document.createElement('div');
    errorOverlay.id = 'global-error-overlay';
    errorOverlay.innerHTML = `
      <div class="error-boundary-container">
        <div class="error-boundary-icon">!</div>
        <h2 class="error-boundary-title">${t('errorBoundary.title')}</h2>
        <p class="error-boundary-message"></p>
        <div class="error-boundary-actions">
          <button class="btn btn-primary" onclick="window.location.reload()" aria-label="${t('errorBoundary.reloadPageAriaLabel')}">
            ${t('errorBoundary.reloadPage')}
          </button>
          <button class="btn btn-secondary" onclick="document.getElementById('global-error-overlay').style.display='none'" aria-label="${t('errorBoundary.dismissAriaLabel')}">
            ${t('errorBoundary.dismiss')}
          </button>
        </div>
        <details class="error-boundary-details">
          <summary>${t('errorBoundary.technicalDetails')}</summary>
          <pre class="error-boundary-stack"></pre>
        </details>
      </div>
    `;
    document.body.appendChild(errorOverlay);
  }

  // Update error message
  const messageEl = errorOverlay.querySelector('.error-boundary-message');
  const stackEl = errorOverlay.querySelector('.error-boundary-stack');

  messageEl.textContent = errorInfo.message || t('errorBoundary.unexpectedError');
  stackEl.textContent = errorInfo.error?.stack || JSON.stringify(errorInfo, null, 2);

  errorOverlay.style.display = 'flex';
}

/**
 * Hide error UI overlay
 */
function hideErrorUI() {
  const errorOverlay = document.getElementById('global-error-overlay');
  if (errorOverlay) {
    errorOverlay.style.display = 'none';
  }
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, options = {}) {
  const { showUI = true, rethrow = false } = options;

  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      handleError({
        type: 'caught',
        message: error.message,
        error,
        functionName: fn.name || 'anonymous',
      });

      if (showUI) {
        showErrorUI({
          message: error.message,
          error,
        });
      }

      if (rethrow) {
        throw error;
      }
    }
  };
}

/**
 * Try-catch wrapper for synchronous functions
 * @param {Function} fn - Function to execute
 * @param {*} fallback - Fallback value on error
 * @returns {*} Result or fallback
 */
export function tryCatch(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    logError('tryCatch error:', error);
    return fallback;
  }
}

export default {
  initErrorBoundary,
  onError,
  getLastError,
  clearLastError,
  withErrorBoundary,
  tryCatch,
};
