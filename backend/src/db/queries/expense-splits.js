// T211: Expense splits queries module
import { query, getClient } from '../connection.js';

/**
 * Create expense splits for an expense
 * @param {string} expenseId - Expense ID
 * @param {Array} splits - Array of split objects { userId, amount, percentage }
 * @returns {Promise<Array>} Created splits
 */
export async function createSplits(expenseId, splits) {
  const client = await getClient();
  const createdSplits = [];

  try {
    await client.query('BEGIN');

    for (const split of splits) {
      const result = await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [expenseId, split.userId, split.amount, split.percentage || null]
      );
      createdSplits.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdSplits;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find splits by expense ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Array>} Array of splits with user info
 */
export async function findByExpenseId(expenseId) {
  const result = await query(
    `SELECT es.*,
            u.email as user_email,
            u.full_name as user_name
     FROM expense_splits es
     JOIN users u ON es.user_id = u.id
     WHERE es.expense_id = $1
     ORDER BY es.created_at`,
    [expenseId]
  );

  return result.rows;
}

/**
 * Find all splits for a user in a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of splits with expense info
 */
export async function findByUserAndTrip(tripId, userId) {
  const result = await query(
    `SELECT es.*,
            e.amount as expense_amount,
            e.description as expense_description,
            e.category as expense_category,
            e.expense_date,
            e.payer_id,
            u.email as payer_email,
            u.full_name as payer_name
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     JOIN users u ON e.payer_id = u.id
     WHERE e.trip_id = $1 AND es.user_id = $2
     ORDER BY e.expense_date DESC`,
    [tripId, userId]
  );

  return result.rows;
}

/**
 * Update a split
 * @param {string} splitId - Split ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated split
 */
export async function update(splitId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['amount', 'percentage', 'settled'];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      if (key === 'settled' && value === true) {
        fields.push(`settled = $${paramIndex++}`);
        values.push(true);
        fields.push(`settled_at = NOW()`);
      } else if (key === 'settled' && value === false) {
        fields.push(`settled = $${paramIndex++}`);
        values.push(false);
        fields.push(`settled_at = NULL`);
      } else {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(splitId);

  const result = await query(
    `UPDATE expense_splits
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Update splits for an expense (replace all)
 * @param {string} expenseId - Expense ID
 * @param {Array} splits - New splits
 * @returns {Promise<Array>} Updated splits
 */
export async function updateSplits(expenseId, splits) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Delete existing splits
    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [
      expenseId,
    ]);

    // Create new splits
    const createdSplits = [];
    for (const split of splits) {
      const result = await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [expenseId, split.userId, split.amount, split.percentage || null]
      );
      createdSplits.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdSplits;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a split
 * @param {string} splitId - Split ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteSplit(splitId) {
  const result = await query('DELETE FROM expense_splits WHERE id = $1', [
    splitId,
  ]);
  return result.rowCount > 0;
}

/**
 * Mark a split as settled
 * @param {string} splitId - Split ID
 * @returns {Promise<Object>} Updated split
 */
export async function markSettled(splitId) {
  const result = await query(
    `UPDATE expense_splits
     SET settled = TRUE, settled_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [splitId]
  );
  return result.rows[0];
}

/**
 * Mark a split as unsettled
 * @param {string} splitId - Split ID
 * @returns {Promise<Object>} Updated split
 */
export async function markUnsettled(splitId) {
  const result = await query(
    `UPDATE expense_splits
     SET settled = FALSE, settled_at = NULL
     WHERE id = $1
     RETURNING *`,
    [splitId]
  );
  return result.rows[0];
}

/**
 * Get unsettled splits for a user in a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of unsettled splits
 */
export async function getUnsettledByUser(tripId, userId) {
  const result = await query(
    `SELECT es.*,
            e.amount as expense_amount,
            e.description as expense_description,
            e.payer_id,
            u.email as payer_email,
            u.full_name as payer_name
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     JOIN users u ON e.payer_id = u.id
     WHERE e.trip_id = $1
       AND es.user_id = $2
       AND es.settled = FALSE
       AND e.payer_id != $2
     ORDER BY e.expense_date DESC`,
    [tripId, userId]
  );

  return result.rows;
}
