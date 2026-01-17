// Categories API service

import { getApiUrl } from './api-client.js';
import { getItem } from '../utils/storage.js';

const API_BASE = getApiUrl();

/**
 * Get authentication headers
 * @returns {Object} Headers object with Authorization
 */
function getAuthHeaders() {
  const token = getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Fetch user's categories (defaults + custom) from the API
 * @returns {Promise<Object>} Categories object with defaults and custom
 */
export async function fetchCategories() {
  const response = await fetch(`${API_BASE}/categories`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch categories');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch default categories only (no auth required)
 * @returns {Promise<Object>} Default categories by domain
 */
export async function fetchDefaultCategories() {
  const response = await fetch(`${API_BASE}/categories/defaults`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch default categories');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Create a new custom category
 * @param {Object} category - Category data { name, icon, domain }
 * @returns {Promise<Object>} Created category
 */
export async function createCategory(category) {
  const response = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Invalid category data');
    }
    throw new Error('Failed to create category');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update an existing custom category
 * @param {string} categoryId - Category UUID
 * @param {Object} updates - Fields to update { name?, icon? }
 * @returns {Promise<Object>} Updated category
 */
export async function updateCategory(categoryId, updates) {
  const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 403) {
      throw new Error('You can only edit your own categories');
    }
    if (response.status === 404) {
      throw new Error('Category not found');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Invalid category data');
    }
    throw new Error('Failed to update category');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete a custom category
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Deletion result with reassignment info
 */
export async function deleteCategory(categoryId) {
  const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 403) {
      throw new Error('You can only delete your own categories');
    }
    if (response.status === 404) {
      throw new Error('Category not found');
    }
    throw new Error('Failed to delete category');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get usage count for a category
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object>} Usage counts { expenses, activities, reservations, documents, total }
 */
export async function getCategoryUsage(categoryId) {
  const response = await fetch(`${API_BASE}/categories/${categoryId}/usage`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 403) {
      throw new Error('You can only view usage of your own categories');
    }
    if (response.status === 404) {
      throw new Error('Category not found');
    }
    throw new Error('Failed to get category usage');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch categories for a specific trip (uses trip owner's categories)
 * @param {string} tripId - Trip UUID
 * @returns {Promise<Object>} Categories object with defaults and custom
 */
export async function fetchTripCategories(tripId) {
  const response = await fetch(`${API_BASE}/trips/${tripId}/categories`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    if (response.status === 404) {
      throw new Error('Trip not found');
    }
    throw new Error('Failed to fetch trip categories');
  }

  const data = await response.json();
  return data.data;
}

export default {
  fetchCategories,
  fetchDefaultCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsage,
  fetchTripCategories,
};
