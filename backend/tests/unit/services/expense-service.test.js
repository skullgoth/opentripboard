/**
 * Unit tests for Expense Service
 * Tests expense CRUD, balance calculations, splits, and settlement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as expenseService from '../../../src/services/expense-service.js';
import * as expenseQueries from '../../../src/db/queries/expenses.js';
import * as expenseSplitQueries from '../../../src/db/queries/expense-splits.js';
import * as tripBuddyService from '../../../src/services/trip-buddy-service.js';
import * as tripQueries from '../../../src/db/queries/trips.js';
import * as connection from '../../../src/db/connection.js';

vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/expenses.js');
vi.mock('../../../src/db/queries/expense-splits.js');
vi.mock('../../../src/services/trip-buddy-service.js');
vi.mock('../../../src/db/queries/trips.js');

function createMockExpense(overrides = {}) {
  return {
    id: 'expense-123',
    trip_id: 'trip-123',
    payer_id: 'user-123',
    payer_email: 'user@test.com',
    payer_name: 'Test User',
    activity_id: null,
    amount: '50.00',
    currency: 'USD',
    category: 'food',
    description: 'Lunch',
    expense_date: '2024-06-02',
    created_at: new Date(),
    updated_at: new Date(),
    splits: [],
    ...overrides,
  };
}

describe('Expense Service', () => {
  const userId = 'user-123';
  const tripId = 'trip-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const validExpenseData = {
      amount: 50,
      category: 'food',
      description: 'Lunch',
      expenseDate: '2024-06-02',
    };

    it('should create an expense successfully', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, currency: 'EUR' });
      vi.mocked(expenseQueries.create).mockResolvedValue(createMockExpense({ currency: 'EUR' }));

      const result = await expenseService.create(tripId, userId, validExpenseData);

      expect(result).toBeDefined();
      expect(result.id).toBe('expense-123');
      expect(expenseQueries.create).toHaveBeenCalled();
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.create(tripId, userId, validExpenseData))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should throw ValidationError for non-positive amount', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(expenseService.create(tripId, userId, { ...validExpenseData, amount: 0 }))
        .rejects
        .toThrow('Amount must be a positive number');
    });

    it('should throw ValidationError for negative amount', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(expenseService.create(tripId, userId, { ...validExpenseData, amount: -10 }))
        .rejects
        .toThrow('Amount must be a positive number');
    });

    it('should throw ValidationError for invalid category', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(
        expenseService.create(tripId, userId, { ...validExpenseData, category: 'invalid' })
      )
        .rejects
        .toThrow('Invalid category');
    });

    it('should throw ValidationError for missing expense date', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(
        expenseService.create(tripId, userId, { ...validExpenseData, expenseDate: null })
      )
        .rejects
        .toThrow('Expense date is required');
    });

    it('should use current user as payer when payerId not specified', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, currency: 'USD' });
      vi.mocked(expenseQueries.create).mockResolvedValue(createMockExpense());

      await expenseService.create(tripId, userId, validExpenseData);

      const createCall = vi.mocked(expenseQueries.create).mock.calls[0];
      expect(createCall[0].payerId).toBe(userId);
    });

    it('should throw ValidationError when payer has no trip access', async () => {
      vi.mocked(tripBuddyService.checkAccess)
        .mockResolvedValueOnce(true)   // user access
        .mockResolvedValueOnce(false); // payer access

      await expect(
        expenseService.create(tripId, userId, { ...validExpenseData, payerId: 'other-user' })
      )
        .rejects
        .toThrow('Payer does not have access to this trip');
    });

    it('should use trip currency when currency not provided', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, currency: 'EUR' });
      vi.mocked(expenseQueries.create).mockResolvedValue(createMockExpense());

      await expenseService.create(tripId, userId, validExpenseData);

      const createCall = vi.mocked(expenseQueries.create).mock.calls[0];
      expect(createCall[0].currency).toBe('EUR');
    });

    it('should accept all valid expense categories', async () => {
      const validCategories = [
        'accommodation', 'transportation', 'food', 'activities',
        'shopping', 'entertainment', 'settlement', 'other',
      ];

      for (const category of validCategories) {
        vi.clearAllMocks();
        vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
        vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, currency: 'USD' });
        vi.mocked(expenseQueries.create).mockResolvedValue(createMockExpense({ category }));

        const result = await expenseService.create(tripId, userId, {
          ...validExpenseData,
          category,
        });
        expect(result).toBeDefined();
      }
    });
  });

  describe('get', () => {
    it('should return a formatted expense', async () => {
      const mockExpense = createMockExpense();
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      const result = await expenseService.get('expense-123', userId);

      expect(result.id).toBe('expense-123');
      expect(result.amount).toBe(50); // parsed from '50.00'
    });

    it('should throw NotFoundError when expense not found', async () => {
      vi.mocked(expenseQueries.findById).mockResolvedValue(null);

      await expect(expenseService.get('nonexistent', userId))
        .rejects
        .toThrow('Expense');
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(expenseQueries.findById).mockResolvedValue(createMockExpense());
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.get('expense-123', userId))
        .rejects
        .toThrow('You do not have access to this expense');
    });
  });

  describe('listByTrip', () => {
    it('should return formatted expenses for a trip', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.findByTripId).mockResolvedValue([
        createMockExpense({ id: 'e1' }),
        createMockExpense({ id: 'e2' }),
      ]);

      const result = await expenseService.listByTrip(tripId, userId);

      expect(result).toHaveLength(2);
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.listByTrip(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should pass options to query', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.findByTripId).mockResolvedValue([]);

      await expenseService.listByTrip(tripId, userId, { category: 'food' });

      expect(expenseQueries.findByTripId).toHaveBeenCalledWith(tripId, { category: 'food' });
    });
  });

  describe('update', () => {
    it('should update an expense as the payer', async () => {
      const mockExpense = createMockExpense({ payer_id: userId });
      vi.mocked(expenseQueries.findById)
        .mockResolvedValueOnce(mockExpense)   // initial fetch
        .mockResolvedValueOnce(mockExpense);  // re-fetch after update
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: 'owner-1' });
      vi.mocked(expenseQueries.update).mockResolvedValue(mockExpense);

      const result = await expenseService.update('expense-123', userId, { description: 'Dinner' });

      expect(result).toBeDefined();
    });

    it('should update an expense as the trip owner', async () => {
      const mockExpense = createMockExpense({ payer_id: 'other-payer' });
      vi.mocked(expenseQueries.findById)
        .mockResolvedValueOnce(mockExpense)
        .mockResolvedValueOnce(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: userId });
      vi.mocked(expenseQueries.update).mockResolvedValue(mockExpense);

      const result = await expenseService.update('expense-123', userId, { description: 'Updated' });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundError when expense not found', async () => {
      vi.mocked(expenseQueries.findById).mockResolvedValue(null);

      await expect(expenseService.update('nonexistent', userId, {}))
        .rejects
        .toThrow('Expense');
    });

    it('should throw AuthorizationError when non-payer non-owner tries to update', async () => {
      const mockExpense = createMockExpense({ payer_id: 'other-user' });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: 'another-owner' });

      await expect(expenseService.update('expense-123', userId, { description: 'test' }))
        .rejects
        .toThrow('Only the payer or trip owner can update this expense');
    });

    it('should throw ValidationError for non-positive amount update', async () => {
      const mockExpense = createMockExpense({ payer_id: userId });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: userId });

      await expect(expenseService.update('expense-123', userId, { amount: -5 }))
        .rejects
        .toThrow('Amount must be a positive number');
    });

    it('should throw ValidationError for invalid category update', async () => {
      const mockExpense = createMockExpense({ payer_id: userId });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: userId });

      await expect(expenseService.update('expense-123', userId, { category: 'bad' }))
        .rejects
        .toThrow('Invalid category');
    });
  });

  describe('deleteExpense', () => {
    it('should delete as payer', async () => {
      const mockExpense = createMockExpense({ payer_id: userId });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: 'owner-1' });
      vi.mocked(expenseQueries.deleteExpense).mockResolvedValue();

      await expenseService.deleteExpense('expense-123', userId);

      expect(expenseQueries.deleteExpense).toHaveBeenCalledWith('expense-123');
    });

    it('should delete as trip owner', async () => {
      const mockExpense = createMockExpense({ payer_id: 'other-payer' });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: userId });
      vi.mocked(expenseQueries.deleteExpense).mockResolvedValue();

      await expenseService.deleteExpense('expense-123', userId);

      expect(expenseQueries.deleteExpense).toHaveBeenCalled();
    });

    it('should throw NotFoundError when expense not found', async () => {
      vi.mocked(expenseQueries.findById).mockResolvedValue(null);

      await expect(expenseService.deleteExpense('nonexistent', userId))
        .rejects
        .toThrow('Expense');
    });

    it('should throw AuthorizationError when non-payer non-owner tries to delete', async () => {
      const mockExpense = createMockExpense({ payer_id: 'other-user' });
      vi.mocked(expenseQueries.findById).mockResolvedValue(mockExpense);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(tripQueries.findById).mockResolvedValue({ id: tripId, owner_id: 'another-owner' });

      await expect(expenseService.deleteExpense('expense-123', userId))
        .rejects
        .toThrow('Only the payer or trip owner can delete this expense');
    });
  });

  describe('getSummary', () => {
    it('should return summary with budget status ok', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.getSummary).mockResolvedValue({
        totalExpenses: 500,
        budget: 2000,
        percentUsed: 25,
      });

      const result = await expenseService.getSummary(tripId, userId);

      expect(result.budgetStatus).toBe('ok');
      expect(result.budgetWarning).toBeNull();
    });

    it('should return warning when over 80% budget used', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.getSummary).mockResolvedValue({
        totalExpenses: 1700,
        budget: 2000,
        percentUsed: 85,
      });

      const result = await expenseService.getSummary(tripId, userId);

      expect(result.budgetStatus).toBe('warning');
      expect(result.budgetWarning).toContain('80%');
    });

    it('should return exceeded when at or over 100% budget', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.getSummary).mockResolvedValue({
        totalExpenses: 2500,
        budget: 2000,
        percentUsed: 125,
      });

      const result = await expenseService.getSummary(tripId, userId);

      expect(result.budgetStatus).toBe('exceeded');
      expect(result.budgetWarning).toContain('exceeded');
    });

    it('should return null status when no budget set', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.getSummary).mockResolvedValue({
        totalExpenses: 500,
        budget: null,
        percentUsed: null,
      });

      const result = await expenseService.getSummary(tripId, userId);

      expect(result.budgetStatus).toBeNull();
      expect(result.budgetWarning).toBeNull();
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.getSummary(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });
  });

  describe('getBalances', () => {
    it('should return formatted balance data', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.calculateBalances).mockResolvedValue({
        participants: [
          {
            id: 'user-1',
            email: 'a@test.com',
            fullName: 'User A',
            totalPaid: 100.555,
            totalOwed: 50.333,
            settlementsPaid: 0,
            settlementsReceived: 0,
            netBalance: 50.222,
          },
        ],
      });

      const result = await expenseService.getBalances(tripId, userId);

      expect(result.participants[0].totalPaid).toBe(100.56); // rounded
      expect(result.participants[0].totalOwed).toBe(50.33);
      expect(result.participants[0].netBalance).toBe(50.22);
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.getBalances(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should handle null settlementsPaid/Received gracefully', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseQueries.calculateBalances).mockResolvedValue({
        participants: [
          {
            id: 'user-1',
            email: 'a@test.com',
            fullName: 'User A',
            totalPaid: 100,
            totalOwed: 50,
            settlementsPaid: null,
            settlementsReceived: null,
            netBalance: 50,
          },
        ],
      });

      const result = await expenseService.getBalances(tripId, userId);

      expect(result.participants[0].settlementsPaid).toBe(0);
      expect(result.participants[0].settlementsReceived).toBe(0);
    });
  });

  describe('settleSplit', () => {
    it('should settle a split as the debtor', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: userId, payer_id: 'payer-1', trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseSplitQueries.markSettled).mockResolvedValue({ id: 'split-1', settled: true });

      const result = await expenseService.settleSplit('split-1', userId);

      expect(result.settled).toBe(true);
    });

    it('should settle a split as the creditor (payer)', async () => {
      const payerId = userId;
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: 'debtor-1', payer_id: payerId, trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseSplitQueries.markSettled).mockResolvedValue({ id: 'split-1', settled: true });

      const result = await expenseService.settleSplit('split-1', userId);

      expect(result.settled).toBe(true);
    });

    it('should throw NotFoundError when split not found', async () => {
      vi.mocked(connection.query).mockResolvedValue({ rows: [] });

      await expect(expenseService.settleSplit('nonexistent', userId))
        .rejects
        .toThrow('Expense split');
    });

    it('should throw AuthorizationError when user has no trip access', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: 'other', payer_id: 'payer', trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(expenseService.settleSplit('split-1', userId))
        .rejects
        .toThrow('You do not have access to this expense');
    });

    it('should throw AuthorizationError when user is neither debtor nor creditor', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: 'debtor', payer_id: 'creditor', trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(expenseService.settleSplit('split-1', userId))
        .rejects
        .toThrow('Only the debtor or creditor can mark this as settled');
    });
  });

  describe('unsettleSplit', () => {
    it('should unsettle a split as the debtor', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: userId, payer_id: 'payer-1', trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(expenseSplitQueries.markUnsettled).mockResolvedValue({
        id: 'split-1',
        settled: false,
      });

      const result = await expenseService.unsettleSplit('split-1', userId);

      expect(result.settled).toBe(false);
    });

    it('should throw NotFoundError when split not found', async () => {
      vi.mocked(connection.query).mockResolvedValue({ rows: [] });

      await expect(expenseService.unsettleSplit('nonexistent', userId))
        .rejects
        .toThrow('Expense split');
    });

    it('should throw AuthorizationError when user is neither debtor nor creditor', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'split-1', user_id: 'debtor', payer_id: 'creditor', trip_id: tripId }],
      });
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(expenseService.unsettleSplit('split-1', userId))
        .rejects
        .toThrow('Only the debtor or creditor can mark this as unsettled');
    });
  });

  describe('createEqualSplits', () => {
    it('should create equal splits for all participants', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      });

      const result = await expenseService.createEqualSplits(tripId, 300);

      expect(result).toHaveLength(3);
      expect(result[0].amount).toBe(100);
      expect(result[0].percentage).toBeCloseTo(33.33, 1);
    });

    it('should handle amounts that do not divide evenly', async () => {
      vi.mocked(connection.query).mockResolvedValue({
        rows: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      });

      const result = await expenseService.createEqualSplits(tripId, 100);

      // Each split should be rounded to 2 decimal places
      result.forEach((split) => {
        expect(split.amount.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
      });
    });
  });
});
