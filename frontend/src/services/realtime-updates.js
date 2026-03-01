/**
 * T109-T112: Real-time update handlers
 * - Optimistic UI for activity changes
 * - Handle incoming WebSocket activity updates
 * - Handle incoming suggestion votes
 * - Handle suggestion resolution
 */

import { wsClient } from './websocket-client.js';
import { logError } from '../utils/error-tracking.js';

/**
 * Real-time update manager
 */
export class RealTimeUpdateManager {
  constructor() {
    this.activityHandlers = [];
    this.suggestionHandlers = [];
    this.expenseHandlers = [];
    this.presenceHandlers = [];
    this.pendingOperations = new Map(); // Track optimistic updates
    this.activeUsers = new Set(); // Track currently active users
    this.initialized = false; // Track if init() has been called
  }

  /**
   * Initialize real-time update handlers
   */
  init() {
    // Prevent multiple initializations
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    // Activity updates
    wsClient.on('activity:created', (message) => this.handleActivityCreated(message));
    wsClient.on('activity:updated', (message) => this.handleActivityUpdated(message));
    wsClient.on('activity:deleted', (message) => this.handleActivityDeleted(message));
    wsClient.on('activity:reordered', (message) => this.handleActivityReordered(message));

    // Expense updates
    wsClient.on('expense:created', (message) => this.handleExpenseEvent(message));
    wsClient.on('expense:updated', (message) => this.handleExpenseEvent(message));
    wsClient.on('expense:deleted', (message) => this.handleExpenseEvent(message));
    wsClient.on('expense:settled', (message) => this.handleExpenseEvent(message));
    wsClient.on('expense:unsettled', (message) => this.handleExpenseEvent(message));

    // Suggestion updates
    wsClient.on('suggestion:created', (message) => this.handleSuggestionCreated(message));
    wsClient.on('suggestion:voted', (message) => this.handleSuggestionVoted(message));
    wsClient.on('suggestion:accepted', (message) => this.handleSuggestionAccepted(message));
    wsClient.on('suggestion:rejected', (message) => this.handleSuggestionRejected(message));
    wsClient.on('suggestion:updated', (message) => this.handleSuggestionUpdated(message));
    wsClient.on('suggestion:deleted', (message) => this.handleSuggestionDeleted(message));

    // Presence updates
    wsClient.on('presence:join', (message) => this.handlePresenceJoin(message));
    wsClient.on('presence:leave', (message) => this.handlePresenceLeave(message));

    // Room events
    wsClient.on('room:joined', (message) => this.handleRoomJoined(message));
    wsClient.on('room:left', (message) => this.handleRoomLeft(message));
  }

  // ============================================
  // Activity Handlers
  // ============================================

  /**
   * Handle activity created (from other users)
   */
  handleActivityCreated(message) {
    this.notifyActivityHandlers({
      type: 'created',
      activity: message.activity,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle activity updated (from other users)
   */
  handleActivityUpdated(message) {
    // Check if this is our own optimistic update coming back
    const opKey = `activity:update:${message.activityId}`;
    if (this.pendingOperations.has(opKey)) {
      this.pendingOperations.delete(opKey);
      return; // Don't apply twice
    }

    this.notifyActivityHandlers({
      type: 'updated',
      activityId: message.activityId,
      activity: message.activity, // Pass full activity object from backend
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle activity deleted (from other users)
   */
  handleActivityDeleted(message) {
    // Check if this is our own optimistic delete
    const opKey = `activity:delete:${message.activityId}`;
    if (this.pendingOperations.has(opKey)) {
      this.pendingOperations.delete(opKey);
      return;
    }

    this.notifyActivityHandlers({
      type: 'deleted',
      activityId: message.activityId,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle activities reordered (from other users)
   */
  handleActivityReordered(message) {
    this.notifyActivityHandlers({
      type: 'reordered',
      activities: message.activities,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  // ============================================
  // Suggestion Handlers
  // ============================================

  /**
   * Handle suggestion created
   */
  handleSuggestionCreated(message) {
    this.notifySuggestionHandlers({
      type: 'created',
      suggestion: message.suggestion,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle suggestion voted
   */
  handleSuggestionVoted(message) {
    // Check if this is our own vote
    const opKey = `suggestion:vote:${message.suggestionId}`;
    if (this.pendingOperations.has(opKey)) {
      this.pendingOperations.delete(opKey);
      return;
    }

    this.notifySuggestionHandlers({
      type: 'voted',
      suggestionId: message.suggestionId,
      suggestion: message.suggestion, // Pass full suggestion object from backend
      vote: message.vote,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle suggestion accepted
   */
  handleSuggestionAccepted(message) {
    this.notifySuggestionHandlers({
      type: 'accepted',
      suggestionId: message.suggestionId,
      suggestion: message.suggestion, // Pass full suggestion object from backend
      activity: message.activity, // The created activity
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle suggestion rejected
   */
  handleSuggestionRejected(message) {
    this.notifySuggestionHandlers({
      type: 'rejected',
      suggestionId: message.suggestionId,
      suggestion: message.suggestion, // Pass full suggestion object from backend
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle suggestion updated
   */
  handleSuggestionUpdated(message) {
    this.notifySuggestionHandlers({
      type: 'updated',
      suggestionId: message.suggestionId,
      suggestion: message.suggestion, // Pass full suggestion object from backend
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  /**
   * Handle suggestion deleted
   */
  handleSuggestionDeleted(message) {
    this.notifySuggestionHandlers({
      type: 'deleted',
      suggestionId: message.suggestionId,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  // ============================================
  // Expense Handlers
  // ============================================

  /**
   * Handle any expense event (created, updated, deleted, settled, unsettled)
   */
  handleExpenseEvent(message) {
    this.notifyExpenseHandlers({
      type: message.type,
      userId: message.userId,
      timestamp: message.timestamp,
    });
  }

  // ============================================
  // Presence Handlers
  // ============================================

  /**
   * Handle user joined room
   */
  handlePresenceJoin(message) {
    this.activeUsers.add(message.userId);
    this.notifyPresenceHandlers({
      type: 'join',
      userId: message.userId,
      timestamp: message.timestamp,
      activeUsers: Array.from(this.activeUsers),
    });
  }

  /**
   * Handle user left room
   */
  handlePresenceLeave(message) {
    this.activeUsers.delete(message.userId);
    this.notifyPresenceHandlers({
      type: 'leave',
      userId: message.userId,
      timestamp: message.timestamp,
      activeUsers: Array.from(this.activeUsers),
    });
  }

  /**
   * Handle room joined confirmation
   */
  handleRoomJoined(message) {
    // Initialize active users with list from server
    if (message.activeUsers) {
      this.activeUsers = new Set(message.activeUsers);
      this.notifyPresenceHandlers({
        type: 'initial',
        activeUsers: Array.from(this.activeUsers),
      });
    }
  }

  /**
   * Handle room left confirmation
   */
  handleRoomLeft(message) {
    // Clear active users
    this.activeUsers.clear();
    this.notifyPresenceHandlers({
      type: 'clear',
      activeUsers: [],
    });
  }

  // ============================================
  // Optimistic Updates
  // ============================================

  /**
   * Perform optimistic activity update
   * @param {string} activityId - Activity ID
   * @param {Object} updates - Updates to apply
   * @param {Function} apiCall - API call to make
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback (for rollback)
   */
  async optimisticActivityUpdate(activityId, updates, apiCall, onSuccess, onError) {
    const opKey = `activity:update:${activityId}`;

    // Mark as pending
    this.pendingOperations.set(opKey, { activityId, updates });

    try {
      // Apply optimistically
      if (onSuccess) {
        onSuccess(updates);
      }

      // Make API call
      const result = await apiCall();

      // Broadcast to other users
      wsClient.send({
        type: 'activity:updated',
        activityId,
        updates,
      });

      // Remove pending operation after a delay
      setTimeout(() => {
        this.pendingOperations.delete(opKey);
      }, 5000);

      return result;

    } catch (error) {
      logError('Optimistic update failed:', error);

      // Rollback
      this.pendingOperations.delete(opKey);

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }

  /**
   * Perform optimistic activity delete
   * @param {string} activityId - Activity ID
   * @param {Function} apiCall - API call to make
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback (for rollback)
   */
  async optimisticActivityDelete(activityId, apiCall, onSuccess, onError) {
    const opKey = `activity:delete:${activityId}`;

    // Mark as pending
    this.pendingOperations.set(opKey, { activityId });

    try {
      // Apply optimistically
      if (onSuccess) {
        onSuccess();
      }

      // Make API call
      await apiCall();

      // Broadcast to other users
      wsClient.send({
        type: 'activity:deleted',
        activityId,
      });

      // Remove pending operation
      setTimeout(() => {
        this.pendingOperations.delete(opKey);
      }, 5000);

    } catch (error) {
      logError('Optimistic delete failed:', error);

      // Rollback
      this.pendingOperations.delete(opKey);

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }

  /**
   * Perform optimistic vote
   * @param {string} suggestionId - Suggestion ID
   * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
   * @param {Function} apiCall - API call to make
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback (for rollback)
   */
  async optimisticVote(suggestionId, vote, apiCall, onSuccess, onError) {
    const opKey = `suggestion:vote:${suggestionId}`;

    // Mark as pending
    this.pendingOperations.set(opKey, { suggestionId, vote });

    try {
      // Apply optimistically
      if (onSuccess) {
        onSuccess(vote);
      }

      // Make API call
      const result = await apiCall();

      // Broadcast to other users
      wsClient.send({
        type: 'suggestion:voted',
        suggestionId,
        vote,
      });

      // Remove pending operation
      setTimeout(() => {
        this.pendingOperations.delete(opKey);
      }, 5000);

      return result;

    } catch (error) {
      logError('Optimistic vote failed:', error);

      // Rollback
      this.pendingOperations.delete(opKey);

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }

  // ============================================
  // Event Subscription
  // ============================================

  /**
   * Register activity event handler
   * @param {Function} handler - Handler function
   */
  onActivityUpdate(handler) {
    this.activityHandlers.push(handler);
  }

  /**
   * Register suggestion event handler
   * @param {Function} handler - Handler function
   */
  onSuggestionUpdate(handler) {
    this.suggestionHandlers.push(handler);
  }

  /**
   * Register expense event handler
   * @param {Function} handler - Handler function
   * @returns {Function} Unsubscribe function
   */
  onExpenseUpdate(handler) {
    this.expenseHandlers.push(handler);
    return () => this.offExpenseUpdate(handler);
  }

  /**
   * Register presence event handler
   * @param {Function} handler - Handler function
   */
  onPresenceUpdate(handler) {
    this.presenceHandlers.push(handler);
  }

  /**
   * Unregister activity event handler
   * @param {Function} handler - Handler function
   */
  offActivityUpdate(handler) {
    const index = this.activityHandlers.indexOf(handler);
    if (index !== -1) {
      this.activityHandlers.splice(index, 1);
    }
  }

  /**
   * Unregister suggestion event handler
   * @param {Function} handler - Handler function
   */
  offSuggestionUpdate(handler) {
    const index = this.suggestionHandlers.indexOf(handler);
    if (index !== -1) {
      this.suggestionHandlers.splice(index, 1);
    }
  }

  /**
   * Unregister expense event handler
   * @param {Function} handler - Handler function
   */
  offExpenseUpdate(handler) {
    const index = this.expenseHandlers.indexOf(handler);
    if (index !== -1) {
      this.expenseHandlers.splice(index, 1);
    }
  }

  /**
   * Unregister presence event handler
   * @param {Function} handler - Handler function
   */
  offPresenceUpdate(handler) {
    const index = this.presenceHandlers.indexOf(handler);
    if (index !== -1) {
      this.presenceHandlers.splice(index, 1);
    }
  }

  /**
   * Notify activity handlers
   * @param {Object} event - Event data
   */
  notifyActivityHandlers(event) {
    this.activityHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logError('Error in activity handler:', error);
      }
    });
  }

  /**
   * Notify suggestion handlers
   * @param {Object} event - Event data
   */
  notifySuggestionHandlers(event) {
    this.suggestionHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logError('Error in suggestion handler:', error);
      }
    });
  }

  /**
   * Notify expense handlers
   * @param {Object} event - Event data
   */
  notifyExpenseHandlers(event) {
    this.expenseHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logError('Error in expense handler:', error);
      }
    });
  }

  /**
   * Notify presence handlers
   * @param {Object} event - Event data
   */
  notifyPresenceHandlers(event) {
    this.presenceHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logError('Error in presence handler:', error);
      }
    });
  }

  /**
   * Cleanup handlers
   */
  cleanup() {
    this.activityHandlers = [];
    this.suggestionHandlers = [];
    this.expenseHandlers = [];
    this.presenceHandlers = [];
    this.pendingOperations.clear();
  }
}

// Create singleton instance
export const realtimeManager = new RealTimeUpdateManager();
