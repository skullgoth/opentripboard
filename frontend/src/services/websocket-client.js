// T047: WebSocket client with connection, reconnection, message dispatch
import { getItem } from '../utils/storage.js';
import { logError } from '../utils/error-tracking.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost/ws';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * WebSocket client for real-time communication
 */
export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.messageHandlers = new Map();
    this.currentTripId = null;
    this.intentionalClose = false;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.connectionStateHandlers = [];
  }

  /**
   * Get current connection state
   * @returns {'connected'|'disconnected'|'reconnecting'|'failed'}
   */
  get connectionState() {
    if (this.isConnected && this.isAuthenticated) return 'connected';
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return 'failed';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  /**
   * Subscribe to connection state changes
   * @param {Function} handler - Called with state string
   * @returns {Function} Unsubscribe function
   */
  onConnectionStateChange(handler) {
    this.connectionStateHandlers.push(handler);
    return () => {
      const idx = this.connectionStateHandlers.indexOf(handler);
      if (idx !== -1) this.connectionStateHandlers.splice(idx, 1);
    };
  }

  /**
   * Notify connection state listeners
   */
  notifyConnectionState() {
    const state = this.connectionState;
    this.connectionStateHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (error) {
        logError('[WS] Error in connection state handler:', error);
      }
    });
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.intentionalClose = false;
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Authenticate immediately after connection
          this.authenticate()
            .then(() => {
              this.notifyConnectionState();
              this.flushMessageQueue();
              resolve();
            })
            .catch((error) => {
              logError('[WS] Authentication failed:', error);
              reject(error);
            });
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          logError('[WS] WebSocket error:', error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.isAuthenticated = false;
          this.notifyConnectionState();

          // Only attempt reconnection if not intentionally closed
          if (!this.intentionalClose) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        logError('[WS] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Authenticate WebSocket connection
   * @returns {Promise<void>}
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      const token = getItem('auth_token');

      if (!token) {
        reject(new Error('No authentication token available'));
        return;
      }

      // Set up one-time auth response handler
      const authHandler = (message) => {
        if (message.type === 'auth:success') {
          this.isAuthenticated = true;
          this.off('auth:success', authHandler);
          this.off('auth:error', errorHandler);
          resolve();
        }
      };

      const errorHandler = (message) => {
        logError('WebSocket authentication failed:', message.message);
        this.off('auth:success', authHandler);
        this.off('auth:error', errorHandler);
        reject(new Error(message.message || 'Authentication failed'));
      };

      this.on('auth:success', authHandler);
      this.on('auth:error', errorHandler);

      // Send auth message directly (bypass queue since not yet authenticated)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'auth', token }));
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logError('[WS] Max reconnection attempts reached');
      this.notifyConnectionState();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempts - 1),
      BACKOFF_MAX_MS
    );

    this.notifyConnectionState();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect()
        .then(() => {
          // Rejoin current trip if any
          if (this.currentTripId) {
            this.joinTrip(this.currentTripId);
          }
        })
        .catch((error) => {
          logError('[WS] Reconnection failed:', error);
        });
    }, delay);
  }

  /**
   * Manually trigger reconnection (resets attempt counter)
   */
  manualReconnect() {
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.notifyConnectionState();

    this.connect()
      .then(() => {
        if (this.currentTripId) {
          this.joinTrip(this.currentTripId);
        }
      })
      .catch((error) => {
        logError('[WS] Manual reconnection failed:', error);
      });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.messageQueue = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.currentTripId = null;
    }
    this.reconnectAttempts = 0;
    this.notifyConnectionState();
  }

  /**
   * Join a trip room
   * @param {string} tripId - Trip ID
   */
  joinTrip(tripId) {
    this.currentTripId = tripId;

    if (!this.isAuthenticated || !this.isConnected) {
      return;
    }

    this.send({
      type: 'room:join',
      tripId,
    });
  }

  /**
   * Leave current trip room
   */
  leaveTrip() {
    if (!this.isAuthenticated || !this.currentTripId) {
      return;
    }

    this.send({
      type: 'room:leave',
    });

    this.currentTripId = null;
  }

  /**
   * Send a message to the server, queuing if disconnected
   * @param {Object} message - Message object
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      // Queue non-auth messages while disconnected
      if (message.type !== 'auth') {
        this.messageQueue.push(message);
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logError('[WS] Failed to send message:', error);
      // Queue the message for retry
      if (message.type !== 'auth') {
        this.messageQueue.push(message);
      }
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  flushMessageQueue() {
    const queue = this.messageQueue.splice(0);
    for (const message of queue) {
      this.send(message);
    }
  }

  /**
   * Handle incoming message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      // Call registered handlers
      const handlers = this.messageHandlers.get(message.type) || [];

      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          logError(`Error in message handler for ${message.type}:`, error);
        }
      });

    } catch (error) {
      logError('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Register a message handler
   * @param {string} messageType - Message type to handle
   * @param {Function} handler - Handler function
   */
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }

    this.messageHandlers.get(messageType).push(handler);
  }

  /**
   * Unregister a message handler
   * @param {string} messageType - Message type
   * @param {Function} handler - Handler function to remove
   */
  off(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      return;
    }

    const handlers = this.messageHandlers.get(messageType);
    const index = handlers.indexOf(handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();
