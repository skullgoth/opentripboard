// T229: Document queries module
import { query } from '../connection.js';

/**
 * Create a new document record
 * @param {Object} documentData - Document data
 * @returns {Promise<Object>} Created document
 */
export async function create(documentData) {
  const {
    tripId,
    activityId,
    uploadedBy,
    fileName,
    fileSize,
    fileType,
    filePath,
    category,
    description,
  } = documentData;

  const result = await query(
    `INSERT INTO documents (
       trip_id, activity_id, uploaded_by, file_name, file_size,
       file_type, file_path, category, description
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tripId,
      activityId || null,
      uploadedBy,
      fileName,
      fileSize,
      fileType,
      filePath,
      category || 'other',
      description,
    ]
  );

  return formatDocument(result.rows[0]);
}

/**
 * Find document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Document or null
 */
export async function findById(documentId) {
  const result = await query(
    `SELECT d.*, u.full_name as uploaded_by_name, u.email as uploaded_by_email
     FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     WHERE d.id = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatDocument(result.rows[0]);
}

/**
 * Find all documents for a trip
 * @param {string} tripId - Trip ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of documents
 */
export async function findByTripId(tripId, options = {}) {
  const { category, activityId } = options;

  let sql = `
    SELECT d.*, u.full_name as uploaded_by_name, u.email as uploaded_by_email
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.trip_id = $1
  `;
  const params = [tripId];
  let paramIndex = 2;

  if (category) {
    sql += ` AND d.category = $${paramIndex++}`;
    params.push(category);
  }

  if (activityId) {
    sql += ` AND d.activity_id = $${paramIndex++}`;
    params.push(activityId);
  }

  sql += ` ORDER BY d.created_at DESC`;

  const result = await query(sql, params);
  return result.rows.map(formatDocument);
}

/**
 * Find documents by activity ID
 * @param {string} activityId - Activity ID
 * @returns {Promise<Array>} Array of documents
 */
export async function findByActivityId(activityId) {
  const result = await query(
    `SELECT d.*, u.full_name as uploaded_by_name, u.email as uploaded_by_email
     FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     WHERE d.activity_id = $1
     ORDER BY d.created_at DESC`,
    [activityId]
  );

  return result.rows.map(formatDocument);
}

/**
 * Update a document
 * @param {string} documentId - Document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated document or null
 */
export async function update(documentId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['category', 'description', 'activity_id'];
  const fieldMap = {
    activityId: 'activity_id',
  };

  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key] || key;
    if (allowedFields.includes(dbField)) {
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return findById(documentId);
  }

  values.push(documentId);

  const result = await query(
    `UPDATE documents
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatDocument(result.rows[0]);
}

/**
 * Delete a document
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Deleted document info (for file cleanup) or null
 */
export async function deleteDocument(documentId) {
  const result = await query(
    `DELETE FROM documents WHERE id = $1 RETURNING file_path`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return { filePath: result.rows[0].file_path };
}

/**
 * Get document count by category for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Category counts
 */
export async function getCategoryCounts(tripId) {
  const result = await query(
    `SELECT category, COUNT(*) as count
     FROM documents
     WHERE trip_id = $1
     GROUP BY category`,
    [tripId]
  );

  const counts = {};
  for (const row of result.rows) {
    counts[row.category] = parseInt(row.count, 10);
  }

  return counts;
}

/**
 * Get total storage used by a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<number>} Total bytes used
 */
export async function getTripStorageUsage(tripId) {
  const result = await query(
    `SELECT COALESCE(SUM(file_size), 0) as total_size
     FROM documents
     WHERE trip_id = $1`,
    [tripId]
  );

  return parseInt(result.rows[0].total_size, 10);
}

/**
 * Format document from database row
 * @param {Object} row - Database row
 * @returns {Object} Formatted document
 */
function formatDocument(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    activityId: row.activity_id,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadedByEmail: row.uploaded_by_email,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    filePath: row.file_path,
    category: row.category,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
