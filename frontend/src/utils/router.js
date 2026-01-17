/**
 * Client-Side Router Utility
 * T046: Simple hash-based routing for SPA navigation
 */

/**
 * Router class for client-side navigation
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeHooks = [];
    this.afterHooks = [];
    this.started = false;

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRouteChange());
  }

  /**
   * Start the router and handle initial route
   */
  start() {
    if (this.started) return;
    this.started = true;
    this.handleRouteChange();
  }

  /**
   * Register a route
   * @param {string} path - Route path (e.g., '/trips', '/trip/:id')
   * @param {Function} handler - Route handler function
   */
  addRoute(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Register multiple routes at once
   * @param {Object} routes - Map of path to handler
   */
  addRoutes(routes) {
    Object.entries(routes).forEach(([path, handler]) => {
      this.addRoute(path, handler);
    });
  }

  /**
   * Navigate to a route
   * @param {string} path - Route path
   * @param {Object} state - Optional state to pass
   */
  navigate(path, state = {}) {
    window.location.hash = path;
    if (Object.keys(state).length > 0) {
      window.history.replaceState(state, '', window.location.href);
    }
  }

  /**
   * Go back in history
   */
  back() {
    window.history.back();
  }

  /**
   * Add before navigation hook
   * @param {Function} hook - Hook function (to, from) => boolean
   */
  beforeEach(hook) {
    this.beforeHooks.push(hook);
  }

  /**
   * Add after navigation hook
   * @param {Function} hook - Hook function (to, from)
   */
  afterEach(hook) {
    this.afterHooks.push(hook);
  }

  /**
   * Handle route changes
   */
  async handleRouteChange() {
    const hash = window.location.hash.slice(1) || '/';
    const previousRoute = this.currentRoute;

    // Run before hooks
    for (const hook of this.beforeHooks) {
      const shouldContinue = await hook(hash, previousRoute);
      if (shouldContinue === false) {
        return;
      }
    }

    // Match route
    const { handler, params } = this.matchRoute(hash);

    if (handler) {
      this.currentRoute = hash;
      await handler(params);

      // Run after hooks
      for (const hook of this.afterHooks) {
        await hook(hash, previousRoute);
      }
    } else {
      console.warn(`No route handler found for: ${hash}`);
    }
  }

  /**
   * Match route path to registered routes
   * @param {string} path - Current path
   * @returns {Object} { handler, params }
   */
  matchRoute(path) {
    // Try exact match first
    if (this.routes.has(path)) {
      return { handler: this.routes.get(path), params: {} };
    }

    // Try dynamic route matching
    for (const [routePath, handler] of this.routes) {
      const params = this.extractParams(routePath, path);
      if (params) {
        return { handler, params };
      }
    }

    return { handler: null, params: {} };
  }

  /**
   * Extract parameters from dynamic route
   * @param {string} routePath - Route pattern (e.g., '/trip/:id')
   * @param {string} actualPath - Actual path (e.g., '/trip/123')
   * @returns {Object|null} Parameters object or null if no match
   */
  extractParams(routePath, actualPath) {
    const routeParts = routePath.split('/');
    const actualParts = actualPath.split('/');

    if (routeParts.length !== actualParts.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = decodeURIComponent(actualParts[i]);
      } else if (routeParts[i] !== actualParts[i]) {
        return null;
      }
    }

    return params;
  }

  /**
   * Get current route
   * @returns {string} Current route path
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
}

// Create singleton instance
const router = new Router();

export default router;
