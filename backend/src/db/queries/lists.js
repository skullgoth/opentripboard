// T228: List queries module
import { query } from '../connection.js';
import { randomUUID } from 'crypto';

/**
 * Create a new list
 * @param {Object} listData - List data
 * @returns {Promise<Object>} Created list
 */
export async function create(listData) {
  const { tripId, type, title, items = [], createdBy } = listData;

  // Ensure items have IDs and order
  const processedItems = items.map((item, index) => ({
    id: item.id || randomUUID(),
    text: item.text,
    checked: item.checked || false,
    order: item.order !== undefined ? item.order : index,
  }));

  const result = await query(
    `INSERT INTO lists (trip_id, type, title, items, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tripId, type, title, JSON.stringify(processedItems), createdBy]
  );

  return formatList(result.rows[0]);
}

/**
 * Find list by ID
 * @param {string} listId - List ID
 * @returns {Promise<Object|null>} List or null
 */
export async function findById(listId) {
  const result = await query(
    'SELECT * FROM lists WHERE id = $1',
    [listId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatList(result.rows[0]);
}

/**
 * Find all lists for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Array>} Array of lists
 */
export async function findByTripId(tripId) {
  const result = await query(
    `SELECT * FROM lists
     WHERE trip_id = $1
     ORDER BY created_at ASC`,
    [tripId]
  );

  return result.rows.map(formatList);
}

/**
 * Update a list
 * @param {string} listId - List ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated list
 */
export async function update(listId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['title', 'type', 'items'];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(key === 'items' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) {
    return findById(listId);
  }

  values.push(listId);

  const result = await query(
    `UPDATE lists
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatList(result.rows[0]);
}

/**
 * Delete a list
 * @param {string} listId - List ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteList(listId) {
  const result = await query(
    'DELETE FROM lists WHERE id = $1',
    [listId]
  );
  return result.rowCount > 0;
}

/**
 * Update list items (partial update)
 * @param {string} listId - List ID
 * @param {Array} items - Updated items array
 * @returns {Promise<Object>} Updated list
 */
export async function updateItems(listId, items) {
  // Ensure items have proper structure
  const processedItems = items.map((item, index) => ({
    id: item.id || randomUUID(),
    text: item.text,
    checked: item.checked || false,
    order: item.order !== undefined ? item.order : index,
  }));

  const result = await query(
    `UPDATE lists
     SET items = $1
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(processedItems), listId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return formatList(result.rows[0]);
}

/**
 * Toggle item checked status
 * @param {string} listId - List ID
 * @param {string} itemId - Item ID
 * @param {boolean} checked - Checked status
 * @returns {Promise<Object>} Updated list
 */
export async function toggleItem(listId, itemId, checked) {
  // Get current list
  const list = await findById(listId);
  if (!list) return null;

  // Update the specific item
  const updatedItems = list.items.map(item => {
    if (item.id === itemId) {
      return { ...item, checked };
    }
    return item;
  });

  return updateItems(listId, updatedItems);
}

/**
 * Add item to list
 * @param {string} listId - List ID
 * @param {Object} item - Item to add { text, checked }
 * @returns {Promise<Object>} Updated list
 */
export async function addItem(listId, item) {
  const list = await findById(listId);
  if (!list) return null;

  const maxOrder = list.items.reduce((max, i) => Math.max(max, i.order || 0), -1);

  const newItem = {
    id: randomUUID(),
    text: item.text,
    checked: item.checked || false,
    order: maxOrder + 1,
  };

  const updatedItems = [...list.items, newItem];
  return updateItems(listId, updatedItems);
}

/**
 * Remove item from list
 * @param {string} listId - List ID
 * @param {string} itemId - Item ID to remove
 * @returns {Promise<Object>} Updated list
 */
export async function removeItem(listId, itemId) {
  const list = await findById(listId);
  if (!list) return null;

  const updatedItems = list.items.filter(item => item.id !== itemId);
  return updateItems(listId, updatedItems);
}

/**
 * Reorder items in list
 * @param {string} listId - List ID
 * @param {Array} itemIds - Array of item IDs in new order
 * @returns {Promise<Object>} Updated list
 */
export async function reorderItems(listId, itemIds) {
  const list = await findById(listId);
  if (!list) return null;

  // Create a map of items by ID
  const itemMap = {};
  for (const item of list.items) {
    itemMap[item.id] = item;
  }

  // Reorder items according to itemIds
  const reorderedItems = itemIds.map((id, index) => ({
    ...itemMap[id],
    order: index,
  }));

  // Add any items not in itemIds at the end
  const missingItems = list.items.filter(item => !itemIds.includes(item.id));
  const allItems = [...reorderedItems, ...missingItems.map((item, i) => ({
    ...item,
    order: reorderedItems.length + i,
  }))];

  return updateItems(listId, allItems);
}

/**
 * Get list statistics
 * @param {string} listId - List ID
 * @returns {Promise<Object>} Statistics { total, checked, percentage }
 */
export async function getStats(listId) {
  const list = await findById(listId);
  if (!list) return null;

  const total = list.items.length;
  const checked = list.items.filter(item => item.checked).length;
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

  return { total, checked, percentage };
}

/**
 * Format list from database row
 * @param {Object} row - Database row
 * @returns {Object} Formatted list
 */
function formatList(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    type: row.type,
    title: row.title,
    items: row.items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
