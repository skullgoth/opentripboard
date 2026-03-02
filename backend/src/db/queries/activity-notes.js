// Activity notes queries module
import { query } from '../connection.js';

/**
 * Create a new activity note
 * @param {Object} noteData - Note data
 * @returns {Promise<Object>} Created note with author info
 */
export async function create(noteData) {
  const { activityId, tripId, authorId, content } = noteData;

  const result = await query(
    `INSERT INTO activity_notes (activity_id, trip_id, author_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [activityId, tripId, authorId, content]
  );

  // Fetch with author name
  return findById(result.rows[0].id);
}

/**
 * Find note by ID
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} Note or null
 */
export async function findById(noteId) {
  const result = await query(
    `SELECT n.*, u.full_name as author_name
     FROM activity_notes n
     LEFT JOIN users u ON n.author_id = u.id
     WHERE n.id = $1`,
    [noteId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatNote(result.rows[0]);
}

/**
 * Find all notes for an activity
 * @param {string} activityId - Activity ID
 * @returns {Promise<Array>} Array of notes
 */
export async function findByActivityId(activityId) {
  const result = await query(
    `SELECT n.*, u.full_name as author_name
     FROM activity_notes n
     LEFT JOIN users u ON n.author_id = u.id
     WHERE n.activity_id = $1
     ORDER BY n.created_at DESC`,
    [activityId]
  );

  return result.rows.map(formatNote);
}

/**
 * Update a note's content
 * @param {string} noteId - Note ID
 * @param {string} content - New content
 * @returns {Promise<Object|null>} Updated note or null
 */
export async function update(noteId, content) {
  const result = await query(
    `UPDATE activity_notes
     SET content = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [content, noteId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return findById(noteId);
}

/**
 * Delete a note
 * @param {string} noteId - Note ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteNote(noteId) {
  const result = await query(
    `DELETE FROM activity_notes WHERE id = $1 RETURNING id`,
    [noteId]
  );

  return result.rows.length > 0;
}

/**
 * Count notes for an activity
 * @param {string} activityId - Activity ID
 * @returns {Promise<number>} Note count
 */
export async function countByActivityId(activityId) {
  const result = await query(
    `SELECT COUNT(*) as count FROM activity_notes WHERE activity_id = $1`,
    [activityId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Format note from database row
 * @param {Object} row - Database row
 * @returns {Object} Formatted note
 */
function formatNote(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    tripId: row.trip_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
