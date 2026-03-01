// T079: Trip state management - current trip, activities, CRUD operations
import { apiClient } from '../utils/api-client.js';
import { realtimeManager } from '../services/realtime-updates.js';
import { logError } from '../utils/error-tracking.js';

/**
 * Trip state management
 */
class TripState {
  constructor() {
    this.trips = [];
    this.currentTrip = null;
    this.currentActivities = [];
    this.listeners = [];
  }

  /**
   * Get all trips for current user
   * @returns {Promise<Array>} Array of trips
   */
  async loadTrips() {
    try {
      const response = await apiClient.get('/trips');
      // Backend returns array directly, not wrapped in {trips: []}
      this.trips = Array.isArray(response) ? response : (response.trips || []);
      this.notifyListeners();
      return this.trips;
    } catch (error) {
      logError('Failed to load trips:', error);
      throw error;
    }
  }

  /**
   * Get a specific trip by ID
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Trip data
   */
  async loadTrip(tripId) {
    try {
      const trip = await apiClient.get(`/trips/${tripId}`);
      // Backend returns trip object directly
      this.currentTrip = trip;
      this.notifyListeners();
      return this.currentTrip;
    } catch (error) {
      logError('Failed to load trip:', error);
      throw error;
    }
  }

  /**
   * Create a new trip
   * @param {Object} tripData - Trip data
   * @returns {Promise<Object>} Created trip
   */
  async createTrip(tripData) {
    try {
      const newTrip = await apiClient.post('/trips', tripData);
      // Backend returns trip object directly

      // Add to trips list
      this.trips.push(newTrip);
      this.notifyListeners();

      return newTrip;
    } catch (error) {
      logError('Failed to create trip:', error);
      throw error;
    }
  }

  /**
   * Update a trip
   * @param {string} tripId - Trip ID
   * @param {Object} tripData - Updated trip data
   * @returns {Promise<Object>} Updated trip
   */
  async updateTrip(tripId, tripData) {
    try {
      const updatedTrip = await apiClient.patch(`/trips/${tripId}`, tripData);
      // Backend returns trip object directly

      // Update in trips list
      const index = this.trips.findIndex((t) => t.id === tripId);
      if (index !== -1) {
        this.trips[index] = updatedTrip;
      }

      // Update current trip if it's the one being updated
      if (this.currentTrip && this.currentTrip.id === tripId) {
        this.currentTrip = updatedTrip;
      }

      this.notifyListeners();
      return updatedTrip;
    } catch (error) {
      logError('Failed to update trip:', error);
      throw error;
    }
  }

  /**
   * Delete a trip
   * @param {string} tripId - Trip ID
   * @returns {Promise<void>}
   */
  async deleteTrip(tripId) {
    try {
      await apiClient.delete(`/trips/${tripId}`);

      // Remove from trips list
      this.trips = this.trips.filter((t) => t.id !== tripId);

      // Clear current trip if it's the one being deleted
      if (this.currentTrip && this.currentTrip.id === tripId) {
        this.currentTrip = null;
        this.currentActivities = [];
      }

      this.notifyListeners();
    } catch (error) {
      logError('Failed to delete trip:', error);
      throw error;
    }
  }

  /**
   * Upload cover image for a trip (T103)
   * @param {string} tripId - Trip ID
   * @param {File} file - Cover image file
   * @returns {Promise<Object>} Updated trip with new cover image URL
   */
  async uploadCoverImage(tripId, file) {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('coverImage', file);

      // Upload to backend
      const response = await apiClient.upload(`/trips/${tripId}/cover-image`, formData);
      const updatedTrip = response.trip; // Extract trip from response

      // Update in trips list
      const index = this.trips.findIndex((t) => t.id === tripId);
      if (index !== -1) {
        this.trips[index] = updatedTrip;
      }

      // Update current trip if it's the one being updated
      if (this.currentTrip && this.currentTrip.id === tripId) {
        this.currentTrip = updatedTrip;
      }

      this.notifyListeners();
      return updatedTrip;
    } catch (error) {
      logError('Failed to upload cover image:', error);
      throw error;
    }
  }

  /**
   * Delete cover image for a trip (T105)
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Updated trip with null cover image URL
   */
  async deleteCoverImage(tripId) {
    try {
      // Delete cover image from backend
      const response = await apiClient.delete(`/trips/${tripId}/cover-image`);
      const updatedTrip = response.trip; // Extract trip from response

      // Update in trips list
      const index = this.trips.findIndex((t) => t.id === tripId);
      if (index !== -1) {
        this.trips[index] = updatedTrip;
      }

      // Update current trip if it's the one being updated
      if (this.currentTrip && this.currentTrip.id === tripId) {
        this.currentTrip = updatedTrip;
      }

      this.notifyListeners();
      return updatedTrip;
    } catch (error) {
      logError('Failed to delete cover image:', error);
      throw error;
    }
  }

  /**
   * Load activities for a trip
   * @param {string} tripId - Trip ID
   * @returns {Promise<Array>} Array of activities
   */
  async loadActivities(tripId) {
    try {
      const activities = await apiClient.get(`/trips/${tripId}/activities`);
      // Backend returns activities array directly
      this.currentActivities = Array.isArray(activities) ? activities : [];
      this.notifyListeners();
      return this.currentActivities;
    } catch (error) {
      logError('Failed to load activities:', error);
      throw error;
    }
  }

  /**
   * Create a new activity
   * @param {string} tripId - Trip ID
   * @param {Object} activityData - Activity data
   * @returns {Promise<Object>} Created activity
   */
  async createActivity(tripId, activityData) {
    try {
      const newActivity = await apiClient.post(`/trips/${tripId}/activities`, activityData);
      // Backend returns activity object directly

      // Add to activities list
      this.currentActivities.push(newActivity);
      this.notifyListeners();

      return newActivity;
    } catch (error) {
      logError('Failed to create activity:', error);
      throw error;
    }
  }

  /**
   * Update an activity
   * @param {string} activityId - Activity ID
   * @param {Object} activityData - Updated activity data
   * @returns {Promise<Object>} Updated activity
   */
  async updateActivity(activityId, activityData) {
    try {
      const updatedActivity = await apiClient.patch(`/activities/${activityId}`, activityData);

      // Update in activities list
      const index = this.currentActivities.findIndex((a) => a.id === activityId);
      if (index !== -1) {
        this.currentActivities[index] = updatedActivity;
      }

      this.notifyListeners();
      return updatedActivity;
    } catch (error) {
      logError('Failed to update activity:', error);
      throw error;
    }
  }

  /**
   * Delete an activity
   * @param {string} activityId - Activity ID
   * @returns {Promise<void>}
   */
  async deleteActivity(activityId) {
    try {
      await apiClient.delete(`/activities/${activityId}`);

      // Remove from activities list
      this.currentActivities = this.currentActivities.filter((a) => a.id !== activityId);
      this.notifyListeners();
    } catch (error) {
      logError('Failed to delete activity:', error);
      throw error;
    }
  }

  /**
   * Reorder activities
   * @param {string} tripId - Trip ID
   * @param {Array} activities - Array of {id, orderIndex}
   * @returns {Promise<void>}
   */
  async reorderActivities(tripId, activities) {
    try {
      // Backend expects 'order' not 'activities'
      await apiClient.post(`/trips/${tripId}/activities/reorder`, {
        order: activities,
      });

      // Update order in current activities
      activities.forEach(({ id, orderIndex }) => {
        const activity = this.currentActivities.find((a) => a.id === id);
        if (activity) {
          activity.orderIndex = orderIndex;
        }
      });

      this.notifyListeners();
    } catch (error) {
      logError('Failed to reorder activities:', error);
      throw error;
    }
  }

  /**
   * Reorder reservations (uses same endpoint as activities since they're stored together)
   * @param {string} tripId - Trip ID
   * @param {Array} reservations - Array of {id, orderIndex}
   * @returns {Promise<void>}
   */
  async reorderReservations(tripId, reservations) {
    try {
      // Reservations are stored as activities, so use the same reorder endpoint
      await apiClient.post(`/trips/${tripId}/activities/reorder`, {
        order: reservations,
      });

      // Update order in current activities (reservations are stored there with metadata.isReservation)
      reservations.forEach(({ id, orderIndex }) => {
        const activity = this.currentActivities.find((a) => a.id === id);
        if (activity) {
          activity.orderIndex = orderIndex;
        }
      });

      this.notifyListeners();
    } catch (error) {
      logError('Failed to reorder reservations:', error);
      throw error;
    }
  }

  /**
   * Get all trips
   * @returns {Array} Array of trips
   */
  getTrips() {
    return this.trips;
  }

  /**
   * Get current trip
   * @returns {Object|null} Current trip or null
   */
  getCurrentTrip() {
    return this.currentTrip;
  }

  /**
   * Get current activities
   * @returns {Array} Array of activities
   */
  getCurrentActivities() {
    return this.currentActivities;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);

    // Return unsubscribe function
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
        listener({
          trips: this.trips,
          currentTrip: this.currentTrip,
          currentActivities: this.currentActivities,
        });
      } catch (error) {
        logError('Trip listener error:', error);
      }
    });
  }

  /**
   * Clear all state
   */
  clear() {
    this.trips = [];
    this.currentTrip = null;
    this.currentActivities = [];
    this.notifyListeners();
  }
}

// Export singleton instance
export const tripState = new TripState();
