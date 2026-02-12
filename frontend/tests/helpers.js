/**
 * Test factory functions for frontend unit tests
 * Provides reusable mock data following backend test patterns
 */

/**
 * Create a mock trip object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock trip
 */
export function createMockTrip(overrides = {}) {
  return {
    id: 'trip-uuid-1',
    name: 'Test Trip to Paris',
    destination: 'Paris, France',
    startDate: '2025-06-01T00:00:00.000Z',
    endDate: '2025-06-07T00:00:00.000Z',
    ownerId: 'user-uuid-1',
    currency: 'EUR',
    budget: 2000,
    coverImageUrl: null,
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
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
    id: 'activity-uuid-1',
    tripId: 'trip-uuid-1',
    type: 'museum',
    name: 'Louvre Museum',
    startTime: '2025-06-02T09:00:00.000Z',
    endTime: '2025-06-02T12:00:00.000Z',
    location: 'Rue de Rivoli, Paris',
    latitude: 48.8606,
    longitude: 2.3376,
    notes: 'Book tickets in advance',
    createdAt: '2025-01-15T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Create a mock preferences object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock preferences
 */
export function createMockPreferences(overrides = {}) {
  return {
    language: 'en',
    dateFormat: 'mdy',
    timeFormat: '12h',
    distanceFormat: 'mi',
    ...overrides,
  };
}

/**
 * Create a mock File object with a given size
 * @param {string} name - File name
 * @param {number} size - File size in bytes
 * @param {string} type - MIME type
 * @returns {File} Mock file
 */
export function createMockFileWithSize(name, size, type = 'image/jpeg') {
  const content = new ArrayBuffer(size);
  return new File([content], name, { type });
}

/**
 * Create a mock HTMLImageElement with given dimensions
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Mock image element
 */
export function createMockImage(width, height) {
  return { width, height };
}
