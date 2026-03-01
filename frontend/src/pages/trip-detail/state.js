// Shared mutable state for trip-detail modules.
// All module-level variables live here so every sub-module sees the same data.

/**
 * Shared context object.
 * Mutations in any module are visible to all others because JS objects
 * are passed by reference.
 */
export const ctx = {
  currentTrip: null,
  currentActivities: [],
  currentSuggestions: [],
  currentTripBuddies: [],
  activeUsers: [],
  sortableInstances: [],
  mapInstance: null,
  mapObserver: null,
  presenceUnsubscribe: null,
  suggestionUnsubscribe: null,
  tripBuddyUnsubscribe: null,
  activityUnsubscribe: null,
  /** @type {Set<string>} IDs of activities we created locally (to skip WS duplicates) */
  pendingActivityIds: new Set(),
  /**
   * Handler references populated by index.js to break circular deps.
   * timeline.js reads these when re-attaching listeners.
   */
  handlers: {},
  /** Cleanup function for the date sidebar IntersectionObserver */
  dateSidebarCleanup: null,
  /** Set by index.js so handler modules can reload the page without importing tripDetailPage */
  reloadPage: null,
  /** Stored filter state for re-applying after timeline refresh */
  timelineFilter: null,
};

/**
 * Reset all mutable state (called during cleanup).
 */
export function resetState() {
  ctx.currentTrip = null;
  ctx.currentActivities = [];
  ctx.currentSuggestions = [];
  ctx.currentTripBuddies = [];
  ctx.activeUsers = [];
  ctx.sortableInstances = [];
  ctx.mapInstance = null;
  ctx.mapObserver = null;
  ctx.presenceUnsubscribe = null;
  ctx.suggestionUnsubscribe = null;
  ctx.tripBuddyUnsubscribe = null;
  ctx.activityUnsubscribe = null;
  ctx.pendingActivityIds.clear();
  ctx.dateSidebarCleanup = null;
  ctx.handlers = {};
  ctx.reloadPage = null;
  ctx.timelineFilter = null;
}
