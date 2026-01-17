// T047: WebSocket client with connection, reconnection, message dispatch
import { getItem } from '../utils/storage.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost/ws';

/**
 * WebSocket client for real-time communication
 */
export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
    this.currentTripId = null;
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('[WS] Connecting to:', WS_URL);
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('[WS] Connection opened');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Authenticate immediately after connection
          this.authenticate()
            .then(() => {
              console.log('[WS] Authentication successful');
              resolve();
            })
            .catch((error) => {
              console.error('[WS] Authentication failed:', error);
              reject(error);
            });
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[WS] WebSocket error:', error);
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Connection closed. Code:', event.code, 'Reason:', event.reason);
          this.isConnected = false;
          this.isAuthenticated = false;

          // Attempt reconnection
          this.reconnect();
        };

      } catch (error) {
        console.error('[WS] Failed to create WebSocket:', error);
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
        console.error('WebSocket authentication failed:', message.message);
        this.off('auth:success', authHandler);
        this.off('auth:error', errorHandler);
        reject(new Error(message.message || 'Authentication failed'));
      };

      this.on('auth:success', authHandler);
      this.on('auth:error', errorHandler);

      // Send auth message
      this.send({
        type: 'auth',
        token,
      });
    });
  }

  /**
   * Reconnect to WebSocket server
   */
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      this.connect()
        .then(() => {
          // Rejoin current trip if any
          if (this.currentTripId) {
            this.joinTrip(this.currentTripId);
          }
        })
        .catch((error) => {
          console.error('Reconnection failed:', error);
        });
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.currentTripId = null;
    }
  }

  /**
   * Join a trip room
   * @param {string} tripId - Trip ID
   */
  joinTrip(tripId) {
    if (!this.isAuthenticated) {
      console.error('[WS] Cannot join trip: not authenticated');
      return;
    }

    if (!this.isConnected) {
      console.error('[WS] Cannot join trip: not connected');
      return;
    }

    console.log('[WS] Joining trip room:', tripId);
    this.currentTripId = tripId;
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
   * Send a message to the server
   * @param {Object} message - Message object
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      console.error('Cannot send message: not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
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
          console.error(`Error in message handler for ${message.type}:`, error);
        }
      });

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
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
