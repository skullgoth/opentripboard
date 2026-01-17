// T062: Trip queries module
import { query } from '../connection.js';

/**
 * Create a new trip
 * @param {Object} tripData - Trip data
 * @returns {Promise<Object>} Created trip
 */
export async function create(tripData) {
  const {
    ownerId,
    name,
    destination,
    startDate,
    endDate,
    budget,
    currency,
    timezone,
    description,
    destinationData, // T009: New - validated destination metadata from Nominatim
    coverImageAttribution, // T009: New - Pexels attribution metadata
  } = tripData;

  const result = await query(
    `INSERT INTO trips (owner_id, name, destination, start_date, end_date, budget, currency, timezone, description, destination_data, cover_image_attribution)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      ownerId,
      name,
      destination,
      startDate,
      endDate,
      budget,
      currency,
      timezone,
      description,
      destinationData ? JSON.stringify(destinationData) : null,
      coverImageAttribution ? JSON.stringify(coverImageAttribution) : null,
    ]
  );

  return result.rows[0];
}

/**
 * Find trip by ID
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object|null>} Trip or null
 */
export async function findById(tripId) {
  const result = await query(
    `SELECT t.*, u.email as owner_email, u.full_name as owner_name
     FROM trips t
     LEFT JOIN users u ON t.owner_id = u.id
     WHERE t.id = $1`,
    [tripId]
  );

  return result.rows[0] || null;
}

/**
 * Find all trips owned by a user
 * @param {string} ownerId - Owner user ID
 * @returns {Promise<Array>} Array of trips
 */
export async function findByOwnerId(ownerId) {
  const result = await query(
    `SELECT * FROM trips
     WHERE owner_id = $1
     ORDER BY start_date DESC NULLS LAST, created_at DESC`,
    [ownerId]
  );

  return result.rows;
}

/**
 * Find all trips where user is owner or trip buddy
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of trips
 */
export async function findByUserId(userId) {
  const result = await query(
    `SELECT DISTINCT t.*,
            CASE WHEN t.owner_id = $1 THEN 'owner'
                 ELSE c.role
            END as user_role
     FROM trips t
     LEFT JOIN trip_buddies c ON t.id = c.trip_id AND c.user_id = $1
     WHERE t.owner_id = $1 OR (c.user_id = $1 AND c.accepted_at IS NOT NULL)
     ORDER BY t.start_date DESC NULLS LAST, t.created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Update a trip
 * @param {string} tripId - Trip ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated trip
 */
export async function update(tripId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name',
    'destination',
    'startDate',
    'endDate',
    'budget',
    'currency',
    'timezone',
    'description',
    'notes', // T229: Alias for description field
    'destinationData', // T009: New - validated destination metadata
    'coverImageAttribution', // T009: New - Pexels attribution metadata
  ];

  const fieldMap = {
    startDate: 'start_date',
    endDate: 'end_date',
    notes: 'description', // T229: Map notes to description field
    destinationData: 'destination_data', // T009: Map camelCase to snake_case
    coverImageAttribution: 'cover_image_attribution', // T009: Map camelCase to snake_case
  };

  // T009: JSONB fields that need JSON.stringify
  const jsonbFields = ['destinationData', 'coverImageAttribution'];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      const dbField = fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbField} = $${paramIndex++}`);

      // T009: Stringify JSONB fields
      if (jsonbFields.includes(key)) {
        values.push(value ? JSON.stringify(value) : null);
      } else {
        values.push(value);
      }
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(tripId);

  const result = await query(
    `UPDATE trips
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Delete a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteTrip(tripId) {
  const result = await query(
    `DELETE FROM trips WHERE id = $1`,
    [tripId]
  );

  return result.rowCount > 0;
}

/**
 * Get trip statistics
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Trip statistics
 */
export async function getStatistics(tripId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM activities WHERE trip_id = $1) as activity_count,
       (SELECT COUNT(*) FROM trip_buddies WHERE trip_id = $1 AND accepted_at IS NOT NULL) as trip_buddy_count,
       (SELECT SUM(amount) FROM expenses WHERE trip_id = $1) as total_expenses
     FROM trips WHERE id = $1`,
    [tripId]
  );

  return result.rows[0] || null;
}

/**
 * T009: Update cover image path and attribution
 * Used when user uploads a custom cover image to replace auto-generated one
 * @param {string} tripId - Trip ID
 * @param {string} coverImagePath - Path to new cover image
 * @param {Object} attribution - Attribution metadata (source: 'user_upload' or 'pexels')
 * @returns {Promise<Object>} Updated trip
 */
export async function updateCoverImage(tripId, coverImagePath, attribution) {
  const result = await query(
    `UPDATE trips
     SET cover_image = $1,
         cover_image_attribution = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [coverImagePath, JSON.stringify(attribution), tripId]
  );

  return result.rows[0];
}
