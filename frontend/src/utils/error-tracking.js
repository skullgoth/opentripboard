// Error tracking utility
// Integrates with Sentry or other error tracking services

const config = {
  enabled: false,
  dsn: null,
  environment: import.meta.env.VITE_ENV || 'development',
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  sampleRate: 1.0,
};

let initialized = false;

/**
 * Initialize error tracking
 * @param {Object} options - Configuration options
 */
export async function initErrorTracking(options = {}) {
  // Get DSN from environment or options
  const dsn = options.dsn || import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  config.enabled = true;
  config.dsn = dsn;
  Object.assign(config, options);

  // Use fallback error tracking (Sentry SDK not installed)
  // To enable Sentry: npm install @sentry/browser, then uncomment Sentry code below
  setupFallbackTracking();
}

/**
 * Set up fallback error tracking (logs to console/server)
 */
function setupFallbackTracking() {
  initialized = true;

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), {
      type: 'unhandled',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason || new Error('Unhandled rejection'), {
      type: 'unhandled_promise',
    });
  });
}

/**
 * Capture an error
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function captureError(error, context = {}) {
  if (!config.enabled) {
    console.error('[ErrorTracking] Error:', error, context);
    return;
  }

  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...context,
  };

  // Try Sentry first
  if (initialized && window.Sentry) {
    window.Sentry.captureException(error, { extra: context });
    return;
  }

  // Fallback: log and optionally send to server
  console.error('[ErrorTracking]', errorData);

  // Send to server endpoint if configured
  const endpoint = import.meta.env.VITE_ERROR_ENDPOINT;
  if (endpoint) {
    sendToServer(endpoint, errorData);
  }
}

/**
 * Capture a message (non-error event)
 * @param {string} message - Message to capture
 * @param {string} level - Level (info, warning, error)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!config.enabled) {
    return;
  }

  if (initialized && window.Sentry) {
    window.Sentry.captureMessage(message, { level, extra: context });
  }
}

/**
 * Set user context for error tracking
 * @param {Object} user - User object with id, email, etc.
 */
export function setUser(user) {
  if (!initialized) return;

  if (window.Sentry) {
    window.Sentry.setUser(user ? {
      id: user.id,
      email: user.email,
      username: user.name,
    } : null);
  }
}

/**
 * Clear user context
 */
export function clearUser() {
  setUser(null);
}

/**
 * Add breadcrumb for debugging
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (navigation, user, http, etc.)
 * @param {Object} data - Additional data
 */
export function addBreadcrumb(message, category = 'default', data = {}) {
  if (!initialized) return;

  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}

/**
 * Set custom tag for filtering
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
export function setTag(key, value) {
  if (!initialized || !window.Sentry) return;
  window.Sentry.setTag(key, value);
}

/**
 * Send error data to server endpoint
 * @param {string} endpoint - Server endpoint URL
 * @param {Object} data - Error data
 */
async function sendToServer(endpoint, data) {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Don't log errors from error tracking
  }
}

/**
 * Wrap a function with error tracking
 * @param {Function} fn - Function to wrap
 * @param {Object} context - Context for errors
 * @returns {Function} Wrapped function
 */
export function withErrorTracking(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, { ...context, args: args.slice(0, 3) });
      throw error;
    }
  };
}
