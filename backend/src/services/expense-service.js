// T212: ExpenseService - expense CRUD and balance calculations
import * as expenseQueries from '../db/queries/expenses.js';
import * as expenseSplitQueries from '../db/queries/expense-splits.js';
import { checkAccess } from './trip-buddy-service.js';
import * as tripQueries from '../db/queries/trips.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';

// Valid expense categories (matching database constraint)
const VALID_CATEGORIES = [
  'accommodation',
  'transportation',
  'food',
  'activities',
  'shopping',
  'entertainment',
  'settlement',
  'other',
];

/**
 * Create a new expense with optional splits
 * @param {string} tripId - Trip ID
 * @param {string} userId - Creating user ID
 * @param {Object} expenseData - Expense data
 * @returns {Promise<Object>} Created expense
 */
export async function create(tripId, userId, expenseData) {
  // Verify access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const {
    payerId,
    activityId,
    amount,
    currency,
    category,
    description,
    expenseDate,
    splits,
  } = expenseData;

  // Validate required fields
  if (!amount || amount <= 0) {
    throw new ValidationError('Amount must be a positive number');
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (!expenseDate) {
    throw new ValidationError('Expense date is required');
  }

  // Use current user as payer if not specified
  const actualPayerId = payerId || userId;

  // Verify payer has access to trip
  const payerHasAccess = await checkAccess(tripId, actualPayerId);
  if (!payerHasAccess) {
    throw new ValidationError('Payer does not have access to this trip');
  }

  // Get trip for currency default
  const trip = await tripQueries.findById(tripId);
  const expenseCurrency = currency || trip.currency || 'USD';

  // Validate splits if provided
  let validatedSplits = [];
  if (splits && splits.length > 0) {
    validatedSplits = await validateSplits(tripId, amount, splits);
  }

  // Create expense
  const expense = await expenseQueries.create(
    {
      tripId,
      payerId: actualPayerId,
      activityId: activityId || null,
      amount,
      currency: expenseCurrency,
      category,
      description: description?.trim() || null,
      expenseDate,
    },
    validatedSplits
  );

  return formatExpense(expense);
}

/**
 * Validate expense splits
 * @param {string} tripId - Trip ID
 * @param {number} totalAmount - Total expense amount
 * @param {Array} splits - Array of splits
 * @returns {Promise<Array>} Validated splits
 */
async function validateSplits(tripId, totalAmount, splits) {
  const validatedSplits = [];
  let totalSplitAmount = 0;

  for (const split of splits) {
    if (!split.userId) {
      throw new ValidationError('Each split must have a userId');
    }

    // Verify user has access to trip
    const hasAccess = await checkAccess(tripId, split.userId);
    if (!hasAccess) {
      throw new ValidationError(`User ${split.userId} does not have access to this trip`);
    }

    let splitAmount = split.amount;
    let splitPercentage = split.percentage;

    // Derive amount from percentage when only percentage is provided (e.g., "50%" of a $100 expense = $50)
    if (splitAmount === undefined && splitPercentage !== undefined) {
      splitAmount = (totalAmount * splitPercentage) / 100;
    }

    if (!splitAmount || splitAmount <= 0) {
      throw new ValidationError('Each split must have a positive amount');
    }

    totalSplitAmount += splitAmount;

    validatedSplits.push({
      userId: split.userId,
      // Round to cents to avoid floating-point artifacts (e.g., 33.33333... -> 33.33)
      amount: Math.round(splitAmount * 100) / 100,
      percentage: splitPercentage || null,
    });
  }

  // Allow 1 cent tolerance for floating-point rounding when splits are calculated
  // from percentages (e.g., a 3-way split of $100 produces 33.33 + 33.33 + 33.33 = 99.99)
  if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
    throw new ValidationError(
      `Split amounts (${totalSplitAmount.toFixed(2)}) must equal expense amount (${totalAmount.toFixed(2)})`
    );
  }

  return validatedSplits;
}

/**
 * Get expense by ID
 * @param {string} expenseId - Expense ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Expense details
 */
export async function get(expenseId, userId) {
  const expense = await expenseQueries.findById(expenseId);

  if (!expense) {
    throw new NotFoundError('Expense');
  }

  // Verify access to trip
  const hasAccess = await checkAccess(expense.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this expense');
  }

  return formatExpense(expense);
}

/**
 * List expenses for a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of expenses
 */
export async function listByTrip(tripId, userId, options = {}) {
  // Verify access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const expenses = await expenseQueries.findByTripId(tripId, options);
  return expenses.map(formatExpense);
}

/**
 * Update an expense
 * @param {string} expenseId - Expense ID
 * @param {string} userId - Requesting user ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated expense
 */
export async function update(expenseId, userId, updates) {
  const expense = await expenseQueries.findById(expenseId);

  if (!expense) {
    throw new NotFoundError('Expense');
  }

  // Verify access to trip
  const hasAccess = await checkAccess(expense.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this expense');
  }

  // Only payer or trip owner can update
  const trip = await tripQueries.findById(expense.trip_id);
  if (expense.payer_id !== userId && trip.owner_id !== userId) {
    throw new AuthorizationError('Only the payer or trip owner can update this expense');
  }

  // Validate updates
  if (updates.amount !== undefined && updates.amount <= 0) {
    throw new ValidationError('Amount must be a positive number');
  }

  if (updates.category && !VALID_CATEGORIES.includes(updates.category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Update expense
  const updatedExpense = await expenseQueries.update(expenseId, updates);

  // Update splits if provided
  if (updates.splits && updates.splits.length > 0) {
    const amount = updates.amount || expense.amount;
    const validatedSplits = await validateSplits(expense.trip_id, parseFloat(amount), updates.splits);
    await expenseSplitQueries.updateSplits(expenseId, validatedSplits);
  }

  // Fetch updated expense with splits
  return get(expenseId, userId);
}

/**
 * Delete an expense
 * @param {string} expenseId - Expense ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<void>}
 */
export async function deleteExpense(expenseId, userId) {
  const expense = await expenseQueries.findById(expenseId);

  if (!expense) {
    throw new NotFoundError('Expense');
  }

  // Verify access to trip
  const hasAccess = await checkAccess(expense.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this expense');
  }

  // Only payer or trip owner can delete
  const trip = await tripQueries.findById(expense.trip_id);
  if (expense.payer_id !== userId && trip.owner_id !== userId) {
    throw new AuthorizationError('Only the payer or trip owner can delete this expense');
  }

  await expenseQueries.deleteExpense(expenseId);
}

/**
 * Get expense summary for a trip
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Expense summary
 */
export async function getSummary(tripId, userId) {
  // Verify access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const summary = await expenseQueries.getSummary(tripId);

  // Check if over budget and add warning
  if (summary.budget !== null && summary.percentUsed !== null) {
    if (summary.percentUsed >= 100) {
      summary.budgetStatus = 'exceeded';
      summary.budgetWarning = 'You have exceeded your trip budget!';
    } else if (summary.percentUsed >= 80) {
      summary.budgetStatus = 'warning';
      summary.budgetWarning = 'You have used over 80% of your trip budget.';
    } else {
      summary.budgetStatus = 'ok';
      summary.budgetWarning = null;
    }
  } else {
    summary.budgetStatus = null;
    summary.budgetWarning = null;
  }

  return summary;
}

/**
 * Get balance sheet (who owes whom)
 * @param {string} tripId - Trip ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Balance information
 */
export async function getBalances(tripId, userId) {
  // Verify access to trip
  const hasAccess = await checkAccess(tripId, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  const balances = await expenseQueries.calculateBalances(tripId);

  // Round all monetary values to cents to avoid displaying floating-point artifacts.
  // netBalance: positive = others owe this person, negative = this person owes others.
  balances.participants = balances.participants.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    totalPaid: Math.round(p.totalPaid * 100) / 100,
    totalOwed: Math.round(p.totalOwed * 100) / 100,
    settlementsPaid: Math.round((p.settlementsPaid || 0) * 100) / 100,
    settlementsReceived: Math.round((p.settlementsReceived || 0) * 100) / 100,
    netBalance: Math.round(p.netBalance * 100) / 100,
  }));

  return balances;
}

/**
 * Mark a split as settled
 * @param {string} splitId - Split ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Updated split
 */
export async function settleSplit(splitId, userId) {
  const splits = await expenseSplitQueries.findByExpenseId(splitId);
  // This is a workaround - we need to get the expense first
  // Let's find the split directly
  const { query } = await import('../db/connection.js');
  const result = await query(
    `SELECT es.*, e.trip_id, e.payer_id
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE es.id = $1`,
    [splitId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Expense split');
  }

  const split = result.rows[0];

  // Verify access to trip
  const hasAccess = await checkAccess(split.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this expense');
  }

  // Only the split user or payer can mark as settled
  if (split.user_id !== userId && split.payer_id !== userId) {
    throw new AuthorizationError('Only the debtor or creditor can mark this as settled');
  }

  const updatedSplit = await expenseSplitQueries.markSettled(splitId);
  return updatedSplit;
}

/**
 * Mark a split as unsettled
 * @param {string} splitId - Split ID
 * @param {string} userId - Requesting user ID
 * @returns {Promise<Object>} Updated split
 */
export async function unsettleSplit(splitId, userId) {
  const { query } = await import('../db/connection.js');
  const result = await query(
    `SELECT es.*, e.trip_id, e.payer_id
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE es.id = $1`,
    [splitId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Expense split');
  }

  const split = result.rows[0];

  // Verify access to trip
  const hasAccess = await checkAccess(split.trip_id, userId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this expense');
  }

  // Only the split user or payer can mark as unsettled
  if (split.user_id !== userId && split.payer_id !== userId) {
    throw new AuthorizationError('Only the debtor or creditor can mark this as unsettled');
  }

  const updatedSplit = await expenseSplitQueries.markUnsettled(splitId);
  return updatedSplit;
}

/**
 * Create equal splits for all trip participants
 * @param {string} tripId - Trip ID
 * @param {number} amount - Total amount to split
 * @returns {Promise<Array>} Array of splits
 */
export async function createEqualSplits(tripId, amount) {
  const { query } = await import('../db/connection.js');

  // Get all trip participants
  const participantsResult = await query(
    `SELECT DISTINCT u.id
     FROM (
       SELECT owner_id as user_id FROM trips WHERE id = $1
       UNION
       SELECT user_id FROM trip_buddies WHERE trip_id = $1 AND accepted_at IS NOT NULL
     ) participants
     JOIN users u ON u.id = participants.user_id`,
    [tripId]
  );

  const participants = participantsResult.rows;
  const splitAmount = amount / participants.length;
  const splitPercentage = 100 / participants.length;

  // Note: rounding each split independently can cause the sum to differ from the total
  // by up to 1 cent (e.g., $100 / 3 = 33.33 * 3 = 99.99). This is accepted by
  // validateSplits() which has a 1-cent tolerance.
  return participants.map((p) => ({
    userId: p.id,
    amount: Math.round(splitAmount * 100) / 100,
    percentage: Math.round(splitPercentage * 100) / 100,
  }));
}

/**
 * Format expense for API response
 * @param {Object} expense - Database expense object
 * @returns {Object} Formatted expense
 */
function formatExpense(expense) {
  return {
    id: expense.id,
    tripId: expense.trip_id,
    payerId: expense.payer_id,
    payerEmail: expense.payer_email,
    payerName: expense.payer_name,
    activityId: expense.activity_id,
    amount: parseFloat(expense.amount),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    expenseDate: expense.expense_date,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
    splits: expense.splits
      ? expense.splits.map((split) => ({
          id: split.id,
          userId: split.user_id,
          userEmail: split.user_email,
          userName: split.user_name,
          amount: parseFloat(split.amount),
          percentage: split.percentage ? parseFloat(split.percentage) : null,
          settled: split.settled,
          settledAt: split.settled_at,
        }))
      : [],
  };
}
