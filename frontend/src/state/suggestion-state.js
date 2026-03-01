// Suggestion state management - CRUD operations for suggestions
import { apiClient } from '../utils/api-client.js';
import { logError } from '../utils/error-tracking.js';

/**
 * Suggestion state management
 */
class SuggestionState {
  constructor() {
    this.suggestions = [];
    this.listeners = [];
  }

  /**
   * Get all suggestions for a trip
   * @param {string} tripId - Trip ID
   * @param {string} status - Optional status filter ('pending' | 'accepted' | 'rejected')
   * @returns {Promise<Array>} Array of suggestions
   */
  async loadSuggestions(tripId, status = null) {
    try {
      const queryParam = status ? `?status=${status}` : '';
      const response = await apiClient.get(`/trips/${tripId}/suggestions${queryParam}`);
      this.suggestions = Array.isArray(response) ? response : (response.suggestions || []);
      this.notifyListeners();
      return this.suggestions;
    } catch (error) {
      logError('Failed to load suggestions:', error);
      throw error;
    }
  }

  /**
   * Get a specific suggestion by ID
   * @param {string} suggestionId - Suggestion ID
   * @returns {Promise<Object>} Suggestion data
   */
  async loadSuggestion(suggestionId) {
    try {
      const suggestion = await apiClient.get(`/suggestions/${suggestionId}`);
      return suggestion;
    } catch (error) {
      logError('Failed to load suggestion:', error);
      throw error;
    }
  }

  /**
   * Create a new suggestion
   * @param {string} tripId - Trip ID
   * @param {Object} suggestionData - Suggestion data
   * @returns {Promise<Object>} Created suggestion
   */
  async createSuggestion(tripId, suggestionData) {
    try {
      const newSuggestion = await apiClient.post(`/trips/${tripId}/suggestions`, suggestionData);

      // Add to suggestions list
      this.suggestions.push(newSuggestion);
      this.notifyListeners();

      return newSuggestion;
    } catch (error) {
      logError('Failed to create suggestion:', error);
      throw error;
    }
  }

  /**
   * Vote on a suggestion
   * @param {string} suggestionId - Suggestion ID
   * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
   * @returns {Promise<Object>} Updated suggestion
   */
  async voteSuggestion(suggestionId, vote) {
    try {
      const updatedSuggestion = await apiClient.post(`/suggestions/${suggestionId}/vote`, { vote });

      // Update in suggestions list
      const index = this.suggestions.findIndex((s) => s.id === suggestionId);
      if (index !== -1) {
        this.suggestions[index] = updatedSuggestion;
      }

      this.notifyListeners();
      return updatedSuggestion;
    } catch (error) {
      logError('Failed to vote on suggestion:', error);
      throw error;
    }
  }

  /**
   * Accept a suggestion (creates activity)
   * @param {string} suggestionId - Suggestion ID
   * @returns {Promise<Object>} Result with activity and updated suggestion
   */
  async acceptSuggestion(suggestionId) {
    try {
      const result = await apiClient.post(`/suggestions/${suggestionId}/accept`, {});

      // Update in suggestions list
      const index = this.suggestions.findIndex((s) => s.id === suggestionId);
      if (index !== -1) {
        this.suggestions[index] = result.suggestion;
      }

      this.notifyListeners();
      return result;
    } catch (error) {
      logError('Failed to accept suggestion:', error);
      throw error;
    }
  }

  /**
   * Reject a suggestion
   * @param {string} suggestionId - Suggestion ID
   * @returns {Promise<Object>} Updated suggestion
   */
  async rejectSuggestion(suggestionId) {
    try {
      const updatedSuggestion = await apiClient.post(`/suggestions/${suggestionId}/reject`, {});

      // Update in suggestions list
      const index = this.suggestions.findIndex((s) => s.id === suggestionId);
      if (index !== -1) {
        this.suggestions[index] = updatedSuggestion;
      }

      this.notifyListeners();
      return updatedSuggestion;
    } catch (error) {
      logError('Failed to reject suggestion:', error);
      throw error;
    }
  }

  /**
   * Update a suggestion
   * @param {string} suggestionId - Suggestion ID
   * @param {Object} suggestionData - Updated suggestion data
   * @returns {Promise<Object>} Updated suggestion
   */
  async updateSuggestion(suggestionId, suggestionData) {
    try {
      const updatedSuggestion = await apiClient.patch(`/suggestions/${suggestionId}`, suggestionData);

      // Update in suggestions list
      const index = this.suggestions.findIndex((s) => s.id === suggestionId);
      if (index !== -1) {
        this.suggestions[index] = updatedSuggestion;
      }

      this.notifyListeners();
      return updatedSuggestion;
    } catch (error) {
      logError('Failed to update suggestion:', error);
      throw error;
    }
  }

  /**
   * Delete a suggestion
   * @param {string} suggestionId - Suggestion ID
   * @returns {Promise<void>}
   */
  async deleteSuggestion(suggestionId) {
    try {
      await apiClient.delete(`/suggestions/${suggestionId}`);

      // Remove from suggestions list
      this.suggestions = this.suggestions.filter((s) => s.id !== suggestionId);
      this.notifyListeners();
    } catch (error) {
      logError('Failed to delete suggestion:', error);
      throw error;
    }
  }

  /**
   * Get suggestion statistics for a trip
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Statistics object
   */
  async loadSuggestionStats(tripId) {
    try {
      const stats = await apiClient.get(`/trips/${tripId}/suggestions/stats`);
      return stats;
    } catch (error) {
      logError('Failed to load suggestion stats:', error);
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
        listener(this.suggestions);
      } catch (error) {
        logError('Error in suggestion state listener:', error);
      }
    });
  }

  /**
   * Clear suggestions (for cleanup)
   */
  clear() {
    this.suggestions = [];
    this.notifyListeners();
  }
}

// Export singleton instance
export const suggestionState = new SuggestionState();
