// T046: API client wrapper with fetch, JWT, and error handling
import { getItem } from '../utils/storage.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Get the API base URL
 * @returns {string} API base URL
 */
export function getApiUrl() {
  return API_BASE_URL;
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, code, errors = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Get authentication headers
 * @returns {Object} Headers with JWT token if available
 */
function getAuthHeaders() {
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
 * Make an API request
 * @param {string} endpoint - API endpoint (e.g., '/trips')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Parse response body
    let data;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      throw new APIError(
        data.message || 'An error occurred',
        response.status,
        data.error || 'UNKNOWN_ERROR',
        data.errors || null
      );
    }

    return data;
  } catch (error) {
    // Network errors or fetch failures
    if (error instanceof APIError) {
      throw error;
    }

    throw new APIError(
      'Network error. Please check your connection.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * GET request
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Response data
 */
export async function get(endpoint, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  return request(url, {
    method: 'GET',
  });
}

/**
 * POST request
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
export async function post(endpoint, body = {}) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
export async function put(endpoint, body = {}) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
export async function patch(endpoint, body = {}) {
  return request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>} Response data
 */
export async function del(endpoint) {
  return request(endpoint, {
    method: 'DELETE',
  });
}

/**
 * Upload file
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - Form data with file
 * @returns {Promise<Object>} Response data
 */
export async function upload(endpoint, formData) {
  const token = getItem('auth_token');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData - browser will set it with boundary

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new APIError(
        data.message || 'Upload failed',
        response.status,
        data.error || 'UPLOAD_ERROR'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    throw new APIError(
      'Network error during upload',
      0,
      'NETWORK_ERROR'
    );
  }
}

// ============================================
// Trip buddy API Methods (T113)
// ============================================

/**
 * Invite a trip buddy to a trip
 * @param {string} tripId - Trip ID
 * @param {string} email - Email of user to invite
 * @param {string} role - Role ('editor' | 'viewer')
 * @returns {Promise<Object>} Trip buddy data
 */
export async function inviteTripBuddy(tripId, email, role) {
  return post(`/trips/${tripId}/trip-buddies`, { email, role });
}

/**
 * Get all trip buddys for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Array>} Array of trip buddys
 */
export async function getTripBuddies(tripId) {
  return get(`/trips/${tripId}/trip-buddies`);
}

/**
 * Get pending invitations for current user
 * @returns {Promise<Array>} Array of pending invitations
 */
export async function getPendingInvitations() {
  return get('/trip-buddies/invitations');
}

/**
 * Accept a trip buddy invitation
 * @param {string} tripBuddyId - Trip buddy ID
 * @returns {Promise<Object>} Updated trip buddy data
 */
export async function acceptInvitation(tripBuddyId) {
  return post(`/trip-buddies/${tripBuddyId}/accept`);
}

/**
 * Update trip buddy role
 * @param {string} tripBuddyId - Trip buddy ID
 * @param {string} role - New role
 * @returns {Promise<Object>} Updated trip buddy data
 */
export async function updateTripBuddyRole(tripBuddyId, role) {
  return patch(`/trip-buddies/${tripBuddyId}`, { role });
}

/**
 * Remove a trip buddy
 * @param {string} tripBuddyId - Trip buddy ID
 * @returns {Promise<void>}
 */
export async function removeTripBuddy(tripBuddyId) {
  return del(`/trip-buddies/${tripBuddyId}`);
}

/**
 * Leave a trip (remove self as trip buddy)
 * @param {string} tripId - Trip ID
 * @returns {Promise<void>}
 */
export async function leaveTrip(tripId) {
  return post(`/trips/${tripId}/leave`);
}

/**
 * Get trip buddy statistics for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Trip buddy stats
 */
export async function getTripBuddyStats(tripId) {
  return get(`/trips/${tripId}/trip-buddies/stats`);
}

// ============================================
// Suggestion API Methods (T114-T115)
// ============================================

/**
 * Create a new suggestion
 * @param {string} tripId - Trip ID
 * @param {Object} suggestionData - Suggestion data
 * @returns {Promise<Object>} Created suggestion
 */
export async function createSuggestion(tripId, suggestionData) {
  return post(`/trips/${tripId}/suggestions`, suggestionData);
}

/**
 * Get all suggestions for a trip
 * @param {string} tripId - Trip ID
 * @param {string} status - Optional status filter ('pending' | 'accepted' | 'rejected')
 * @returns {Promise<Array>} Array of suggestions
 */
export async function getSuggestions(tripId, status = null) {
  return get(`/trips/${tripId}/suggestions`, status ? { status } : {});
}

/**
 * Get a specific suggestion
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<Object>} Suggestion data
 */
export async function getSuggestion(suggestionId) {
  return get(`/suggestions/${suggestionId}`);
}

/**
 * Vote on a suggestion
 * @param {string} suggestionId - Suggestion ID
 * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
 * @returns {Promise<Object>} Updated suggestion with vote counts
 */
export async function voteSuggestion(suggestionId, vote) {
  return post(`/suggestions/${suggestionId}/vote`, { vote });
}

/**
 * Accept a suggestion (creates activity)
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<Object>} Created activity and updated suggestion
 */
export async function acceptSuggestion(suggestionId) {
  return post(`/suggestions/${suggestionId}/accept`);
}

/**
 * Reject a suggestion
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<Object>} Updated suggestion
 */
export async function rejectSuggestion(suggestionId) {
  return post(`/suggestions/${suggestionId}/reject`);
}

/**
 * Update a suggestion
 * @param {string} suggestionId - Suggestion ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated suggestion
 */
export async function updateSuggestion(suggestionId, updates) {
  return patch(`/suggestions/${suggestionId}`, updates);
}

/**
 * Delete a suggestion
 * @param {string} suggestionId - Suggestion ID
 * @returns {Promise<void>}
 */
export async function deleteSuggestion(suggestionId) {
  return del(`/suggestions/${suggestionId}`);
}

/**
 * Get suggestion statistics for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Suggestion stats
 */
export async function getSuggestionStats(tripId) {
  return get(`/trips/${tripId}/suggestions/stats`);
}

// ============================================
// Reservation API Methods (T195-T196)
// ============================================

/**
 * Import a reservation from email content
 * @param {string} tripId - Trip ID
 * @param {string} emailContent - Email HTML/text content
 * @returns {Promise<Object>} Created activity with reservation data
 */
export async function importReservation(tripId, emailContent) {
  return post(`/trips/${tripId}/reservations/import`, { emailContent });
}

/**
 * Preview parsed reservation from email (without creating)
 * @param {string} tripId - Trip ID
 * @param {string} emailContent - Email HTML/text content
 * @returns {Promise<Object>} Parsed reservation preview
 */
export async function previewReservation(tripId, emailContent) {
  return post(`/trips/${tripId}/reservations/preview`, { emailContent });
}

/**
 * Get all reservations for a trip
 * @param {string} tripId - Trip ID
 * @param {string} type - Optional type filter ('flight', 'accommodation', etc.)
 * @returns {Promise<Object>} Reservations with grouping by type
 */
export async function getReservations(tripId, type = null) {
  return get(`/trips/${tripId}/reservations`, type ? { type } : {});
}

// ============================================
// Expense API Methods (T213-T214)
// ============================================

/**
 * Create a new expense
 * @param {string} tripId - Trip ID
 * @param {Object} expenseData - Expense data
 * @returns {Promise<Object>} Created expense
 */
export async function createExpense(tripId, expenseData) {
  return post(`/trips/${tripId}/expenses`, expenseData);
}

/**
 * Get all expenses for a trip
 * @param {string} tripId - Trip ID
 * @param {Object} filters - Optional filters { category, startDate, endDate }
 * @returns {Promise<Array>} Array of expenses
 */
export async function getExpenses(tripId, filters = {}) {
  return get(`/trips/${tripId}/expenses`, filters);
}

/**
 * Get a specific expense
 * @param {string} tripId - Trip ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Expense data
 */
export async function getExpense(tripId, expenseId) {
  return get(`/trips/${tripId}/expenses/${expenseId}`);
}

/**
 * Update an expense
 * @param {string} tripId - Trip ID
 * @param {string} expenseId - Expense ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated expense
 */
export async function updateExpense(tripId, expenseId, updates) {
  return patch(`/trips/${tripId}/expenses/${expenseId}`, updates);
}

/**
 * Delete an expense
 * @param {string} tripId - Trip ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<void>}
 */
export async function deleteExpense(tripId, expenseId) {
  return del(`/trips/${tripId}/expenses/${expenseId}`);
}

/**
 * Get expense summary for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Expense summary with totals and categories
 */
export async function getExpenseSummary(tripId) {
  return get(`/trips/${tripId}/expenses/summary`);
}

/**
 * Get balance sheet (who owes whom) for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Balance data with participants and debts
 */
export async function getExpenseBalances(tripId) {
  return get(`/trips/${tripId}/expenses/balances`);
}

/**
 * Mark an expense split as settled
 * @param {string} tripId - Trip ID
 * @param {string} splitId - Split ID
 * @returns {Promise<Object>} Updated split
 */
export async function settleExpenseSplit(tripId, splitId) {
  return post(`/trips/${tripId}/expenses/splits/${splitId}/settle`);
}

/**
 * Mark an expense split as unsettled
 * @param {string} tripId - Trip ID
 * @param {string} splitId - Split ID
 * @returns {Promise<Object>} Updated split
 */
export async function unsettleExpenseSplit(tripId, splitId) {
  return post(`/trips/${tripId}/expenses/splits/${splitId}/unsettle`);
}

// ============================================
// Lists API Methods (US6)
// ============================================

/**
 * Get all list templates
 * @returns {Promise<Array>} Array of template summaries
 */
export async function getListTemplates() {
  return get('/list-templates');
}

/**
 * Get a specific list template
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Template with items
 */
export async function getListTemplate(templateId) {
  return get(`/list-templates/${templateId}`);
}

/**
 * Get all lists for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Array>} Array of lists with stats
 */
export async function getLists(tripId) {
  return get(`/trips/${tripId}/lists`);
}

/**
 * Get a specific list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @returns {Promise<Object>} List with items and stats
 */
export async function getList(tripId, listId) {
  return get(`/trips/${tripId}/lists/${listId}`);
}

/**
 * Create a new list
 * @param {string} tripId - Trip ID
 * @param {Object} listData - List data { title, type, items? }
 * @returns {Promise<Object>} Created list
 */
export async function createList(tripId, listData) {
  return post(`/trips/${tripId}/lists`, listData);
}

/**
 * Create a list from a template
 * @param {string} tripId - Trip ID
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Created list
 */
export async function createListFromTemplate(tripId, templateId) {
  return post(`/trips/${tripId}/lists/from-template/${templateId}`);
}

/**
 * Update a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {Object} updates - Fields to update { title?, type? }
 * @returns {Promise<Object>} Updated list
 */
export async function updateList(tripId, listId, updates) {
  return patch(`/trips/${tripId}/lists/${listId}`, updates);
}

/**
 * Delete a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @returns {Promise<void>}
 */
export async function deleteList(tripId, listId) {
  return del(`/trips/${tripId}/lists/${listId}`);
}

/**
 * Add item to a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {Object} item - Item data { text, checked? }
 * @returns {Promise<Object>} Updated list
 */
export async function addListItem(tripId, listId, item) {
  return post(`/trips/${tripId}/lists/${listId}/items`, item);
}

/**
 * Toggle item checked status
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {string} itemId - Item ID
 * @param {boolean} checked - New checked status
 * @returns {Promise<Object>} Updated list
 */
export async function toggleListItem(tripId, listId, itemId, checked) {
  return patch(`/trips/${tripId}/lists/${listId}/items/${itemId}`, { checked });
}

/**
 * Delete item from a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} Updated list
 */
export async function deleteListItem(tripId, listId, itemId) {
  return del(`/trips/${tripId}/lists/${listId}/items/${itemId}`);
}

/**
 * Update all items in a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {Array} items - Updated items array
 * @returns {Promise<Object>} Updated list
 */
export async function updateListItems(tripId, listId, items) {
  return put(`/trips/${tripId}/lists/${listId}/items`, { items });
}

/**
 * Reorder items in a list
 * @param {string} tripId - Trip ID
 * @param {string} listId - List ID
 * @param {Array} itemIds - Array of item IDs in new order
 * @returns {Promise<Object>} Updated list
 */
export async function reorderListItems(tripId, listId, itemIds) {
  return post(`/trips/${tripId}/lists/${listId}/reorder`, { itemIds });
}

// ============================================
// Document API Methods (T229)
// ============================================

/**
 * Get all documents for a trip
 * @param {string} tripId - Trip ID
 * @param {Object} filters - Optional filters (category, activityId)
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocuments(tripId, filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const endpoint = `/trips/${tripId}/documents${params ? `?${params}` : ''}`;
  return get(endpoint);
}

/**
 * Get document statistics for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Document stats
 */
export async function getDocumentStats(tripId) {
  return get(`/trips/${tripId}/documents/stats`);
}

/**
 * Upload a document
 * @param {string} tripId - Trip ID
 * @param {FormData} formData - Form data with file and metadata
 * @returns {Promise<Object>} Created document
 */
export async function uploadDocument(tripId, formData) {
  return upload(`/trips/${tripId}/documents`, formData);
}

/**
 * Get a specific document
 * @param {string} tripId - Trip ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Document
 */
export async function getDocument(tripId, documentId) {
  return get(`/trips/${tripId}/documents/${documentId}`);
}

/**
 * Download a document
 * @param {string} tripId - Trip ID
 * @param {string} documentId - Document ID
 * @param {string} fileName - File name for download
 * @returns {Promise<void>}
 */
export async function downloadDocument(tripId, documentId, fileName) {
  const token = getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}/documents/${documentId}/download`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new APIError('Failed to download document', response.status, 'DOWNLOAD_ERROR');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Update a document
 * @param {string} tripId - Trip ID
 * @param {string} documentId - Document ID
 * @param {Object} updates - Updates (category, description, activityId)
 * @returns {Promise<Object>} Updated document
 */
export async function updateDocument(tripId, documentId, updates) {
  return patch(`/trips/${tripId}/documents/${documentId}`, updates);
}

/**
 * Delete a document
 * @param {string} tripId - Trip ID
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(tripId, documentId) {
  return del(`/trips/${tripId}/documents/${documentId}`);
}

/**
 * Get documents for an activity
 * @param {string} tripId - Trip ID
 * @param {string} activityId - Activity ID
 * @returns {Promise<Array>} Array of documents
 */
export async function getActivityDocuments(tripId, activityId) {
  return get(`/trips/${tripId}/activities/${activityId}/documents`);
}

// Export the request function for custom requests
export { request };

// Default export with all API methods
const apiClient = {
  get,
  post,
  put,
  patch,
  del,
  upload,
  inviteTripBuddy,
  getTripBuddies,
  getPendingInvitations,
  acceptInvitation,
  updateTripBuddyRole,
  removeTripBuddy,
  leaveTrip,
  getTripBuddyStats,
  createSuggestion,
  getSuggestions,
  getSuggestion,
  voteSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  updateSuggestion,
  deleteSuggestion,
  getSuggestionStats,
  importReservation,
  previewReservation,
  getReservations,
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getExpenseBalances,
  settleExpenseSplit,
  unsettleExpenseSplit,
  request,
  APIError
};

export default apiClient;
