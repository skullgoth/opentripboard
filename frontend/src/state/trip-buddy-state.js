// Trip Buddy state management - CRUD operations for trip tripBuddies
import { apiClient } from '../utils/api-client.js';

/**
 * Trip Buddy state management
 */
class TripBuddyState {
  constructor() {
    this.tripBuddies = [];
    this.listeners = [];
  }

  /**
   * Get all tripBuddies for a trip
   * @param {string} tripId - Trip ID
   * @returns {Promise<Array>} Array of tripBuddies
   */
  async loadTripBuddies(tripId) {
    try {
      const response = await apiClient.get(`/trips/${tripId}/trip-buddies`);
      this.tripBuddies = Array.isArray(response) ? response : (response.tripBuddies || []);
      this.notifyListeners();
      return this.tripBuddies;
    } catch (error) {
      console.error('Failed to load tripBuddies:', error);
      throw error;
    }
  }

  /**
   * Invite a tripBuddy to a trip
   * @param {string} tripId - Trip ID
   * @param {Object} tripBuddyData - Trip Buddy data (email, role)
   * @returns {Promise<Object>} Created tripBuddy
   */
  async inviteTripBuddy(tripId, tripBuddyData) {
    try {
      const newTripBuddy = await apiClient.post(`/trips/${tripId}/trip-buddies`, tripBuddyData);

      // Add to tripBuddies list
      this.tripBuddies.push(newTripBuddy);
      this.notifyListeners();

      return newTripBuddy;
    } catch (error) {
      console.error('Failed to invite tripBuddy:', error);
      throw error;
    }
  }

  /**
   * Update tripBuddy role
   * @param {string} tripBuddyId - Trip Buddy ID
   * @param {string} role - New role ('editor' | 'viewer')
   * @returns {Promise<Object>} Updated tripBuddy
   */
  async updateTripBuddyRole(tripBuddyId, role) {
    try {
      const updatedTripBuddy = await apiClient.patch(`/trip-buddies/${tripBuddyId}`, { role });

      // Update in tripBuddies list
      const index = this.tripBuddies.findIndex((c) => c.id === tripBuddyId);
      if (index !== -1) {
        this.tripBuddies[index] = updatedTripBuddy;
      }

      this.notifyListeners();
      return updatedTripBuddy;
    } catch (error) {
      console.error('Failed to update tripBuddy:', error);
      throw error;
    }
  }

  /**
   * Remove a tripBuddy from a trip
   * @param {string} tripBuddyId - Trip Buddy ID
   * @returns {Promise<void>}
   */
  async removeTripBuddy(tripBuddyId) {
    try {
      await apiClient.delete(`/trip-buddies/${tripBuddyId}`);

      // Remove from tripBuddies list
      this.tripBuddies = this.tripBuddies.filter((c) => c.id !== tripBuddyId);
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to remove tripBuddy:', error);
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Listener function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.tripBuddies);
      } catch (error) {
        console.error('Error in tripBuddy state listener:', error);
      }
    });
  }

  /**
   * Clear tripBuddies (for cleanup)
   */
  clear() {
    this.tripBuddies = [];
    this.notifyListeners();
  }
}

// Export singleton instance
export const tripBuddyState = new TripBuddyState();
