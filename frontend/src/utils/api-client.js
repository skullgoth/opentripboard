// API Client - HTTP request utility with authentication
import { getItem, setItem } from './storage.js';
import { withCsrfToken } from './csrf.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * API Client for making HTTP requests
 */
class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication headers
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    const token = getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized - token expired
      if (response.status === 401) {
        // Don't redirect if we're trying to login or already on login page
        const isLoginRequest = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');

        if (!isLoginRequest) {
          // Clear auth data
          setItem('auth_token', null);
          setItem('user', null);

          // Redirect to login
          window.location.href = '/login';
          throw new Error('Authentication expired. Please login again.');
        }

        // For login/register requests, just throw the error without redirecting
        const data = await response.json();
        throw new Error(data.message || 'Invalid email or password');
      }

      // Handle 204 No Content - no response body
      if (response.status === 204) {
        return null;
      }

      // Parse response
      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      // Network errors or parsing errors
      if (error instanceof TypeError) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>} Response data
   */
  async get(endpoint) {
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data) {
    const headers = await withCsrfToken();
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data) {
    const headers = await withCsrfToken();
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers,
    });
  }

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data) {
    const headers = await withCsrfToken();
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers,
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint) {
    const headers = await withCsrfToken();
    return this.request(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  /**
   * Upload file (multipart/form-data)
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with file
   * @returns {Promise<any>} Response data
   */
  async upload(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getItem('auth_token');
    const headers = await withCsrfToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData - browser will set it with boundary

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        setItem('auth_token', null);
        setItem('user', null);
        window.location.href = '/login';
        throw new Error('Authentication expired. Please login again.');
      }

      // Parse response
      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        throw new Error(data.message || `Upload failed: HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Network error during upload. Please check your connection.');
      }
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
