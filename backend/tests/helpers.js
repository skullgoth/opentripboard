/**
 * Test helpers and utilities
 */

/**
 * Create a mock user object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock user
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    password_hash: '$2b$12$KIXxkPKQXMeHnFZ1234567890abcdefghijklmnopqrstuvwxyz',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock trip object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock trip
 */
export function createMockTrip(overrides = {}) {
  return {
    id: 'trip-123',
    owner_id: 'user-123',
    name: 'Summer Vacation',
    destination: 'Paris, France',
    start_date: new Date('2024-06-01T00:00:00Z'),
    end_date: new Date('2024-06-07T00:00:00Z'),
    budget: 2000,
    currency: 'USD',
    timezone: 'Europe/Paris',
    description: 'A wonderful trip to Paris',
    cover_image_url: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock activity object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock activity
 */
export function createMockActivity(overrides = {}) {
  return {
    id: 'activity-123',
    trip_id: 'trip-123',
    type: 'attraction',
    title: 'Visit Eiffel Tower',
    description: 'Iconic landmark visit',
    location: 'Champ de Mars, Paris',
    latitude: 48.858844,
    longitude: 2.294351,
    start_time: new Date('2024-06-02T10:00:00Z'),
    end_time: new Date('2024-06-02T12:00:00Z'),
    order_index: 0,
    metadata: {},
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock collaborator object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock collaborator
 */
export function createMockTripBuddy(overrides = {}) {
  return {
    id: 'collab-123',
    trip_id: 'trip-123',
    user_id: 'user-456',
    role: 'editor',
    invited_by: 'user-123',
    invited_at: new Date('2024-01-01T00:00:00Z'),
    accepted_at: new Date('2024-01-02T00:00:00Z'),
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock suggestion object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock suggestion
 */
export function createMockSuggestion(overrides = {}) {
  return {
    id: 'suggestion-123',
    trip_id: 'trip-123',
    suggested_by_user_id: 'user-456',
    activity_type: 'restaurant',
    title: 'Le Cinq Restaurant',
    description: 'Fine dining experience',
    location: 'Four Seasons Hotel George V, Paris',
    latitude: 48.868217,
    longitude: 2.301111,
    start_time: new Date('2024-06-03T19:00:00Z'),
    end_time: new Date('2024-06-03T21:00:00Z'),
    votes: [],
    status: 'pending',
    resolved_at: null,
    resolved_by: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Create a mock database query result
 * @param {Array} rows - Result rows
 * @returns {Object} Mock query result
 */
export function createMockQueryResult(rows = []) {
  return {
    rows,
    rowCount: rows.length,
    command: 'SELECT',
    fields: [],
  };
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
