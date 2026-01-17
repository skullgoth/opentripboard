/**
 * Database queries for suggestions
 * Task: T092 [P] [US2] Create suggestion queries
 */

import { getPool } from '../connection.js';

const pool = getPool();

/**
 * Create a new suggestion
 * @param {Object} suggestionData - Suggestion data
 * @returns {Promise<Object>} Created suggestion record
 */
export async function create(suggestionData) {
  const {
    tripId,
    suggestedByUserId,
    activityType,
    title,
    description,
    location,
    latitude,
    longitude,
    startTime,
    endTime,
  } = suggestionData;

  const query = `
    INSERT INTO suggestions (
      trip_id, suggested_by_user_id, activity_type, title, description,
      location, latitude, longitude, start_time, end_time, votes, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '[]'::jsonb, 'pending')
    RETURNING *
  `;

  const result = await pool.query(query, [
    tripId,
    suggestedByUserId,
    activityType,
    title,
    description || null,
    location || null,
    latitude || null,
    longitude || null,
    startTime || null,
    endTime || null,
  ]);

  return result.rows[0];
}

/**
 * Find all suggestions for a trip
 * @param {string} tripId - Trip UUID
 * @param {string} status - Optional filter by status ('pending' | 'accepted' | 'rejected')
 * @returns {Promise<Array>} Array of suggestion records with user info
 */
export async function findByTripId(tripId, status = null) {
  let query = `
    SELECT
      s.*,
      u.email as suggested_by_email,
      u.full_name as suggested_by_name
    FROM suggestions s
    JOIN users u ON s.suggested_by_user_id = u.id
    WHERE s.trip_id = $1
  `;

  const params = [tripId];

  if (status) {
    query += ` AND s.status = $2`;
    params.push(status);
  }

  query += ` ORDER BY s.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Find all suggestions made by a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of suggestion records with trip info
 */
export async function findByUserId(userId) {
  const query = `
    SELECT
      s.*,
      t.name as trip_name,
      t.destination
    FROM suggestions s
    JOIN trips t ON s.trip_id = t.id
    WHERE s.suggested_by_user_id = $1
    ORDER BY s.created_at DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Find a specific suggestion by ID
 * @param {string} suggestionId - Suggestion UUID
 * @returns {Promise<Object|null>} Suggestion record or null
 */
export async function findById(suggestionId) {
  const query = `
    SELECT
      s.*,
      u.email as suggested_by_email,
      u.full_name as suggested_by_name
    FROM suggestions s
    JOIN users u ON s.suggested_by_user_id = u.id
    WHERE s.id = $1
  `;

  const result = await pool.query(query, [suggestionId]);
  return result.rows[0] || null;
}

/**
 * Add or update a vote on a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} userId - User UUID voting
 * @param {string} vote - Vote type ('up' | 'down' | 'neutral')
 * @returns {Promise<Object>} Updated suggestion record
 */
export async function addVote(suggestionId, userId, vote) {
  // First, get current votes
  const currentQuery = `SELECT votes FROM suggestions WHERE id = $1`;
  const currentResult = await pool.query(currentQuery, [suggestionId]);

  if (currentResult.rows.length === 0) {
    throw new Error('Suggestion not found');
  }

  const votes = currentResult.rows[0].votes || [];

  // Remove any existing vote from this user
  const filteredVotes = votes.filter(v => v.userId !== userId);

  // Add new vote if not neutral (neutral = remove vote)
  if (vote !== 'neutral') {
    filteredVotes.push({ userId, vote, timestamp: new Date().toISOString() });
  }

  // Update with new votes array
  const updateQuery = `
    UPDATE suggestions
    SET votes = $1::jsonb
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(updateQuery, [JSON.stringify(filteredVotes), suggestionId]);
  return result.rows[0];
}

/**
 * Get vote summary for a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @returns {Promise<Object>} Vote summary with upvotes, downvotes, total
 */
export async function getVoteSummary(suggestionId) {
  const query = `
    SELECT
      id,
      votes,
      (SELECT COUNT(*) FROM jsonb_array_elements(votes) AS v WHERE v->>'vote' = 'up') as upvotes,
      (SELECT COUNT(*) FROM jsonb_array_elements(votes) AS v WHERE v->>'vote' = 'down') as downvotes,
      jsonb_array_length(votes) as total_votes
    FROM suggestions
    WHERE id = $1
  `;

  const result = await pool.query(query, [suggestionId]);
  return result.rows[0] || null;
}

/**
 * Accept a suggestion (creates activity and marks as accepted)
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} resolvedBy - User UUID who accepted
 * @returns {Promise<Object>} Updated suggestion record
 */
export async function accept(suggestionId, resolvedBy) {
  const query = `
    UPDATE suggestions
    SET
      status = 'accepted',
      resolved_at = NOW(),
      resolved_by = $2
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [suggestionId, resolvedBy]);
  return result.rows[0];
}

/**
 * Reject a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @param {string} resolvedBy - User UUID who rejected
 * @returns {Promise<Object>} Updated suggestion record
 */
export async function reject(suggestionId, resolvedBy) {
  const query = `
    UPDATE suggestions
    SET
      status = 'rejected',
      resolved_at = NOW(),
      resolved_by = $2
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [suggestionId, resolvedBy]);
  return result.rows[0];
}

/**
 * Update a suggestion (before it's accepted/rejected)
 * @param {string} suggestionId - Suggestion UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated suggestion record
 */
export async function update(suggestionId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'activityType',
    'title',
    'description',
    'location',
    'latitude',
    'longitude',
    'startTime',
    'endTime',
  ];

  const fieldMap = {
    activityType: 'activity_type',
    startTime: 'start_time',
    endTime: 'end_time',
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

  values.push(suggestionId);

  const query = `
    UPDATE suggestions
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND status = 'pending'
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Delete a suggestion
 * @param {string} suggestionId - Suggestion UUID
 * @returns {Promise<boolean>} True if deleted
 */
export async function remove(suggestionId) {
  const query = `
    DELETE FROM suggestions WHERE id = $1
  `;

  const result = await pool.query(query, [suggestionId]);
  return result.rowCount > 0;
}

/**
 * Delete all suggestions for a trip
 * @param {string} tripId - Trip UUID
 * @returns {Promise<number>} Number of suggestions deleted
 */
export async function removeAllByTripId(tripId) {
  const query = `
    DELETE FROM suggestions WHERE trip_id = $1
  `;

  const result = await pool.query(query, [tripId]);
  return result.rowCount;
}

/**
 * Get pending suggestions count for a trip
 * @param {string} tripId - Trip UUID
 * @returns {Promise<number>} Number of pending suggestions
 */
export async function countPendingByTripId(tripId) {
  const query = `
    SELECT COUNT(*) as count
    FROM suggestions
    WHERE trip_id = $1 AND status = 'pending'
  `;

  const result = await pool.query(query, [tripId]);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if a user has already suggested a similar activity
 * @param {string} tripId - Trip UUID
 * @param {string} userId - User UUID
 * @param {string} title - Activity title
 * @returns {Promise<Object|null>} Existing suggestion or null
 */
export async function findSimilar(tripId, userId, title) {
  const query = `
    SELECT * FROM suggestions
    WHERE trip_id = $1
      AND suggested_by_user_id = $2
      AND LOWER(title) = LOWER($3)
      AND status = 'pending'
  `;

  const result = await pool.query(query, [tripId, userId, title]);
  return result.rows[0] || null;
}
