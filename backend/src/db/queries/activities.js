// T063: Activity queries module
import { query, getClient } from '../connection.js';

/**
 * Create a new activity
 * @param {Object} activityData - Activity data
 * @returns {Promise<Object>} Created activity
 */
export async function create(activityData) {
  const {
    tripId,
    type,
    title,
    description,
    location,
    latitude,
    longitude,
    startTime,
    endTime,
    orderIndex,
    metadata,
    createdBy, // T149: Track who created the activity
  } = activityData;

  const result = await query(
    `INSERT INTO activities (
       trip_id, type, title, description, location, latitude, longitude,
       start_time, end_time, order_index, metadata, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      tripId,
      type,
      title,
      description,
      location,
      latitude,
      longitude,
      startTime,
      endTime,
      orderIndex !== undefined ? orderIndex : 0,
      metadata || {},
      createdBy, // T149: Set created_by field
    ]
  );

  return result.rows[0];
}

/**
 * Find activities by trip ID
 * @param {string} tripId - Trip ID
 * @returns {Promise<Array>} Array of activities with creator/updater names
 */
export async function findByTripId(tripId) {
  const result = await query(
    `SELECT a.*,
       creator.full_name as created_by_name,
       creator.email as created_by_email,
       updater.full_name as updated_by_name,
       updater.email as updated_by_email
     FROM activities a
     LEFT JOIN users creator ON a.created_by = creator.id
     LEFT JOIN users updater ON a.updated_by = updater.id
     WHERE a.trip_id = $1
     ORDER BY a.order_index ASC, a.start_time ASC NULLS LAST, a.updated_at DESC`,
    [tripId]
  );

  return result.rows;
}

/**
 * Find activity by ID
 * @param {string} activityId - Activity ID
 * @returns {Promise<Object|null>} Activity with creator/updater names or null
 */
export async function findById(activityId) {
  const result = await query(
    `SELECT a.*,
       creator.full_name as created_by_name,
       creator.email as created_by_email,
       updater.full_name as updated_by_name,
       updater.email as updated_by_email
     FROM activities a
     LEFT JOIN users creator ON a.created_by = creator.id
     LEFT JOIN users updater ON a.updated_by = updater.id
     WHERE a.id = $1`,
    [activityId]
  );

  return result.rows[0] || null;
}

/**
 * Update an activity
 * @param {string} activityId - Activity ID
 * @param {Object} updates - Fields to update
 * @param {string} updatedBy - User ID who is updating (T149: Track who updated)
 * @returns {Promise<Object>} Updated activity
 */
export async function update(activityId, updates, updatedBy) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'type',
    'title',
    'description',
    'location',
    'latitude',
    'longitude',
    'startTime',
    'endTime',
    'orderIndex',
    'metadata',
  ];

  const fieldMap = {
    startTime: 'start_time',
    endTime: 'end_time',
    orderIndex: 'order_index',
  };

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      const dbField = fieldMap[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  // T149: Add updated_by field
  if (updatedBy) {
    fields.push(`updated_by = $${paramIndex++}`);
    values.push(updatedBy);
  }

  values.push(activityId);

  const result = await query(
    `UPDATE activities
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Delete an activity
 * @param {string} activityId - Activity ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteActivity(activityId) {
  const result = await query(
    `DELETE FROM activities WHERE id = $1`,
    [activityId]
  );

  return result.rowCount > 0;
}

/**
 * Reorder activities for a trip
 * @param {string} tripId - Trip ID
 * @param {Array<{id: string, orderIndex: number}>} orderUpdates - Array of activity IDs with new order indices
 * @returns {Promise<Array>} Updated activities
 */
export async function reorder(tripId, orderUpdates) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const updatedActivities = [];

    for (const { id, orderIndex } of orderUpdates) {
      const result = await client.query(
        `UPDATE activities
         SET order_index = $1
         WHERE id = $2 AND trip_id = $3
         RETURNING *`,
        [orderIndex, id, tripId]
      );

      if (result.rows[0]) {
        updatedActivities.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');

    return updatedActivities;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get activities by date range
 * @param {string} tripId - Trip ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of activities
 */
export async function findByDateRange(tripId, startDate, endDate) {
  const result = await query(
    `SELECT * FROM activities
     WHERE trip_id = $1
     AND start_time >= $2
     AND start_time <= $3
     ORDER BY start_time ASC`,
    [tripId, startDate, endDate]
  );

  return result.rows;
}

/**
 * Get activities grouped by day
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Activities grouped by date
 */
export async function findGroupedByDay(tripId) {
  const result = await query(
    `SELECT
       DATE(start_time) as date,
       json_agg(
         activities ORDER BY order_index ASC, start_time ASC
       ) as activities
     FROM activities
     WHERE trip_id = $1 AND start_time IS NOT NULL
     GROUP BY DATE(start_time)
     ORDER BY DATE(start_time) ASC`,
    [tripId]
  );

  return result.rows;
}
