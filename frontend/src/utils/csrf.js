// CSRF token management for frontend
// Works with the backend CSRF middleware when enabled

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

let csrfToken = null;
let tokenPromise = null;

/**
 * Get CSRF token from cookie
 * @returns {string|null}
 */
function getTokenFromCookie() {
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

/**
 * Fetch a new CSRF token from the server
 * @returns {Promise<string>}
 */
async function fetchToken() {
  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';

  try {
    const response = await fetch(`${apiUrl}/csrf-token`, {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.warn('Failed to fetch CSRF token:', error);
  }

  // Fallback to cookie if fetch fails
  return getTokenFromCookie();
}

/**
 * Get the current CSRF token, fetching if necessary
 * @returns {Promise<string|null>}
 */
export async function getCsrfToken() {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  // Check cookie first
  const cookieToken = getTokenFromCookie();
  if (cookieToken) {
    csrfToken = cookieToken;
    return csrfToken;
  }

  // Fetch from server (deduplicate concurrent requests)
  if (!tokenPromise) {
    tokenPromise = fetchToken().finally(() => {
      tokenPromise = null;
    });
  }

  return tokenPromise;
}

/**
 * Get CSRF headers for fetch requests
 * @returns {Promise<Object>}
 */
export async function getCsrfHeaders() {
  const token = await getCsrfToken();

  if (token) {
    return { [CSRF_HEADER_NAME]: token };
  }

  return {};
}

/**
 * Add CSRF token to request headers
 * Use this for state-changing requests (POST, PUT, PATCH, DELETE)
 * @param {Object} headers - Existing headers object
 * @returns {Promise<Object>} Headers with CSRF token added
 */
export async function withCsrfToken(headers = {}) {
  const csrfHeaders = await getCsrfHeaders();
  return { ...headers, ...csrfHeaders };
}

/**
 * Clear cached CSRF token (call after logout)
 */
export function clearCsrfToken() {
  csrfToken = null;
}

/**
 * Initialize CSRF token on app load
 * This pre-fetches the token to avoid delays on first request
 */
export async function initCsrf() {
  try {
    await getCsrfToken();
  } catch {
    // Ignore errors - CSRF may be disabled
  }
}
