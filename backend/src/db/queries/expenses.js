// T210: Expense queries module
import { query, getClient } from '../connection.js';

/**
 * Create a new expense with splits
 * @param {Object} expenseData - Expense data
 * @param {Array} splits - Array of split objects { userId, amount, percentage }
 * @returns {Promise<Object>} Created expense with splits
 */
export async function create(expenseData, splits = []) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const {
      tripId,
      payerId,
      activityId,
      amount,
      currency,
      category,
      description,
      expenseDate,
    } = expenseData;

    // Create expense
    const expenseResult = await client.query(
      `INSERT INTO expenses (trip_id, payer_id, activity_id, amount, currency, category, description, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tripId, payerId, activityId || null, amount, currency || 'USD', category, description, expenseDate]
    );

    const expense = expenseResult.rows[0];

    // Create splits if provided
    const createdSplits = [];
    for (const split of splits) {
      const splitResult = await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [expense.id, split.userId, split.amount, split.percentage || null]
      );
      createdSplits.push(splitResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...expense,
      splits: createdSplits,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find expense by ID with splits
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object|null>} Expense with splits or null
 */
export async function findById(expenseId) {
  const expenseResult = await query(
    `SELECT e.*,
            u.email as payer_email,
            u.full_name as payer_name
     FROM expenses e
     JOIN users u ON e.payer_id = u.id
     WHERE e.id = $1`,
    [expenseId]
  );

  if (expenseResult.rows.length === 0) {
    return null;
  }

  const expense = expenseResult.rows[0];

  // Get splits with user info
  const splitsResult = await query(
    `SELECT es.*,
            u.email as user_email,
            u.full_name as user_name
     FROM expense_splits es
     JOIN users u ON es.user_id = u.id
     WHERE es.expense_id = $1
     ORDER BY es.created_at`,
    [expenseId]
  );

  return {
    ...expense,
    splits: splitsResult.rows,
  };
}

/**
 * Find all expenses for a trip
 * @param {string} tripId - Trip ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of expenses with splits
 */
export async function findByTripId(tripId, options = {}) {
  const { category, startDate, endDate } = options;

  let whereClause = 'e.trip_id = $1';
  const params = [tripId];
  let paramIndex = 2;

  if (category) {
    whereClause += ` AND e.category = $${paramIndex++}`;
    params.push(category);
  }

  if (startDate) {
    whereClause += ` AND e.expense_date >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ` AND e.expense_date <= $${paramIndex++}`;
    params.push(endDate);
  }

  const expenseResult = await query(
    `SELECT e.*,
            u.email as payer_email,
            u.full_name as payer_name
     FROM expenses e
     JOIN users u ON e.payer_id = u.id
     WHERE ${whereClause}
     ORDER BY e.expense_date DESC, e.created_at DESC`,
    params
  );

  const expenses = expenseResult.rows;

  // Get splits for all expenses
  if (expenses.length > 0) {
    const expenseIds = expenses.map((e) => e.id);
    const splitsResult = await query(
      `SELECT es.*,
              u.email as user_email,
              u.full_name as user_name
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = ANY($1)
       ORDER BY es.created_at`,
      [expenseIds]
    );

    // Group splits by expense_id
    const splitsByExpense = {};
    for (const split of splitsResult.rows) {
      if (!splitsByExpense[split.expense_id]) {
        splitsByExpense[split.expense_id] = [];
      }
      splitsByExpense[split.expense_id].push(split);
    }

    // Attach splits to expenses
    for (const expense of expenses) {
      expense.splits = splitsByExpense[expense.id] || [];
    }
  }

  return expenses;
}

/**
 * Update an expense
 * @param {string} expenseId - Expense ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated expense
 */
export async function update(expenseId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'amount',
    'currency',
    'category',
    'description',
    'expenseDate',
    'activityId',
  ];

  const fieldMap = {
    expenseDate: 'expense_date',
    activityId: 'activity_id',
  };

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      const dbField = fieldMap[key] || key;
      fields.push(`${dbField} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(expenseId);

  const result = await query(
    `UPDATE expenses
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Delete an expense (cascade deletes splits)
 * @param {string} expenseId - Expense ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteExpense(expenseId) {
  const result = await query('DELETE FROM expenses WHERE id = $1', [expenseId]);
  return result.rowCount > 0;
}

/**
 * Get expense summary for a trip
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Summary with totals by category
 */
export async function getSummary(tripId) {
  const result = await query(
    `WITH expense_stats AS (
       SELECT
         COALESCE(SUM(amount) FILTER (WHERE category != 'settlement'), 0) AS total_spent,
         COUNT(*) AS expense_count
       FROM expenses
       WHERE trip_id = $1
     ),
     category_breakdown AS (
       SELECT COALESCE(
         json_agg(
           json_build_object('category', category, 'total', total)
           ORDER BY total DESC
         ),
         '[]'::json
       ) AS by_category
       FROM (
         SELECT category, SUM(amount) AS total
         FROM expenses
         WHERE trip_id = $1 AND category != 'settlement'
         GROUP BY category
       ) cats
     )
     SELECT t.budget, t.currency,
            es.total_spent, es.expense_count,
            cb.by_category
     FROM trips t
     CROSS JOIN expense_stats es
     CROSS JOIN category_breakdown cb
     WHERE t.id = $1`,
    [tripId]
  );

  const row = result.rows[0];

  if (!row) {
    return {
      budget: null,
      currency: 'USD',
      totalSpent: 0,
      remaining: null,
      percentUsed: null,
      expenseCount: 0,
      byCategory: [],
    };
  }

  const totalSpent = parseFloat(row.total_spent);
  const budget = row.budget ? parseFloat(row.budget) : null;

  return {
    budget,
    currency: row.currency || 'USD',
    totalSpent,
    remaining: budget !== null ? budget - totalSpent : null,
    percentUsed: budget !== null && budget > 0 ? (totalSpent / budget) * 100 : null,
    expenseCount: parseInt(row.expense_count, 10),
    byCategory: row.by_category.map((item) => ({
      category: item.category,
      total: parseFloat(item.total),
    })),
  };
}

/**
 * Calculate balances (who owes whom)
 * @param {string} tripId - Trip ID
 * @returns {Promise<Object>} Balance information
 */
export async function calculateBalances(tripId) {
  // Get all expenses for the trip with their splits
  const expenses = await findByTripId(tripId);

  // Get all trip participants (trip buddies + owner)
  const participantsResult = await query(
    `SELECT DISTINCT u.id, u.email, u.full_name
     FROM (
       SELECT owner_id as user_id FROM trips WHERE id = $1
       UNION
       SELECT user_id FROM trip_buddies WHERE trip_id = $1 AND accepted_at IS NOT NULL
     ) participants
     JOIN users u ON u.id = participants.user_id`,
    [tripId]
  );

  const participants = participantsResult.rows;
  const participantMap = {};
  for (const p of participants) {
    participantMap[p.id] = {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      totalPaid: 0,
      totalOwed: 0,
      settlementsPaid: 0,
      settlementsReceived: 0,
    };
  }

  // Calculate what each person paid and owes
  for (const expense of expenses) {
    const isSettlement = expense.category === 'settlement';
    const amount = parseFloat(expense.amount);

    if (isSettlement) {
      // Settlement: track separately for balance calculation
      // Payer made a settlement payment (reduces their debt)
      if (participantMap[expense.payer_id]) {
        participantMap[expense.payer_id].settlementsPaid += amount;
      }
      // Split recipient received a settlement (reduces what they're owed)
      for (const split of expense.splits) {
        if (participantMap[split.user_id]) {
          participantMap[split.user_id].settlementsReceived += parseFloat(split.amount);
        }
      }
    } else {
      // Regular expense: add to totals
      if (participantMap[expense.payer_id]) {
        participantMap[expense.payer_id].totalPaid += amount;
      }

      for (const split of expense.splits) {
        if (participantMap[split.user_id]) {
          participantMap[split.user_id].totalOwed += parseFloat(split.amount);
        }
      }
    }
  }

  // Calculate net balance for each participant
  // Net = (what they paid + settlements they made) - (what they owe + settlements they received)
  // Or simplified: (totalPaid - totalOwed) + (settlementsPaid - settlementsReceived)
  const balances = Object.values(participantMap).map((p) => ({
    ...p,
    // Net balance from actual expenses (positive = owed money, negative = owes money)
    netBalance: (p.totalPaid - p.totalOwed) + (p.settlementsPaid - p.settlementsReceived),
  }));

  // Calculate simplified debts (who owes whom)
  const debts = simplifyDebts(balances);

  return {
    participants: balances,
    debts,
  };
}

/**
 * Simplify debts to minimize number of transactions
 * @param {Array} balances - Array of participant balances
 * @returns {Array} Simplified debt list
 */
function simplifyDebts(balances) {
  const debts = [];

  // Separate creditors and debtors
  const creditors = balances
    .filter((b) => b.netBalance > 0.01) // owed money
    .sort((a, b) => b.netBalance - a.netBalance);

  const debtors = balances
    .filter((b) => b.netBalance < -0.01) // owes money
    .sort((a, b) => a.netBalance - b.netBalance);

  // Match debtors to creditors
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amountToSettle = Math.min(
      creditor.netBalance,
      Math.abs(debtor.netBalance)
    );

    if (amountToSettle > 0.01) {
      debts.push({
        from: {
          id: debtor.id,
          email: debtor.email,
          fullName: debtor.fullName,
        },
        to: {
          id: creditor.id,
          email: creditor.email,
          fullName: creditor.fullName,
        },
        amount: Math.round(amountToSettle * 100) / 100,
      });
    }

    creditor.netBalance -= amountToSettle;
    debtor.netBalance += amountToSettle;

    if (creditor.netBalance < 0.01) i++;
    if (debtor.netBalance > -0.01) j++;
  }

  return debts;
}
