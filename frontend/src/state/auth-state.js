// T080: Auth state management - login, register, token storage, logout
// US8: Extended with role-based access control helpers
import { apiClient } from '../utils/api-client.js';
import { getItem, setItem } from '../utils/storage.js';

/**
 * Authentication state management
 */
class AuthState {
  constructor() {
    this.user = null;
    this.token = null;
    this.listeners = [];

    // Load from storage on initialization
    this.loadFromStorage();
  }

  /**
   * Load authentication data from storage
   */
  loadFromStorage() {
    const token = getItem('auth_token');
    const user = getItem('user');

    if (token && user) {
      this.token = token;
      this.user = user;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  /**
   * Get current user
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * US8: Check if current user is an admin
   * @returns {boolean} True if user has admin role
   */
  isAdmin() {
    return this.user?.role === 'admin';
  }

  /**
   * US8: Get current user's role
   * @returns {string|null} User role or null
   */
  getRole() {
    return this.user?.role || null;
  }

  /**
   * US8: Update current user's profile in state
   * @param {Object} updatedUser - Updated user data
   */
  updateCurrentUser(updatedUser) {
    if (this.user) {
      this.user = { ...this.user, ...updatedUser };
      setItem('user', this.user);
      this.notifyListeners();
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} User data
   */
  async register(userData) {
    try {
      const response = await apiClient.post('/auth/register', {
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
      });

      // Backend returns accessToken and refreshToken
      this.setAuthData(response.accessToken, response.user);

      return response.user;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data
   */
  async login(email, password) {
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      // Backend returns accessToken and refreshToken
      this.setAuthData(response.accessToken, response.user);

      return response.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  logout() {
    // Clear state
    this.user = null;
    this.token = null;

    // Clear storage
    setItem('auth_token', null);
    setItem('user', null);

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Set authentication data
   * @param {string} token - JWT token
   * @param {Object} user - User data
   */
  setAuthData(token, user) {
    this.token = token;
    this.user = user;

    // Store in localStorage
    setItem('auth_token', token);
    setItem('user', user);

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Subscribe to auth state changes
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
        listener(this.user);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string>} New token
   */
  async refreshToken() {
    try {
      const response = await apiClient.post('/auth/refresh', {
        token: this.token,
      });

      this.token = response.token;
      setItem('auth_token', response.token);

      return response.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
      throw error;
    }
  }
}

// Export singleton instance
export const authState = new AuthState();
