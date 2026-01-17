
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock pg module at the top
vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Expenses Routes', () => {
  let app;
  let expenseService;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/services/expense-service.js', () => ({
      create: vi.fn(),
      listByTrip: vi.fn(),
      getSummary: vi.fn(),
      getBalances: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      deleteExpense: vi.fn(),
      settleSplit: vi.fn(),
      unsettleSplit: vi.fn(),
      createEqualSplits: vi.fn(),
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
      validateParams: vi.fn(() => (req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
      NotFoundError: class NotFoundError extends Error {
        constructor(message) { super(message); this.statusCode = 404; }
      },
      ValidationError: class ValidationError extends Error {
        constructor(message) { super(message); this.statusCode = 400; }
      },
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const expenseRoutes = (await import('../../../src/routes/expenses.js')).default;
    expenseService = await import('../../../src/services/expense-service.js');

    app = Fastify();
    app.register(expenseRoutes);
  });

  describe('POST /trips/:tripId/expenses', () => {
    it('should create a new expense', async () => {
      const mockExpense = { id: 'expense-123', amount: 100, category: 'food' };
      expenseService.create.mockResolvedValue(mockExpense);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses',
        payload: { amount: 100, category: 'food', expenseDate: '2025-01-01' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockExpense);
      expect(expenseService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ amount: 100, category: 'food', expenseDate: '2025-01-01' })
      );
    });

    it('should create a new expense with equal splits if splitEvenly is true', async () => {
      const mockExpense = { id: 'expense-123', amount: 100, category: 'food' };
      const mockSplits = [{ userId: 'user-1', amount: 50 }, { userId: 'user-2', amount: 50 }];
      expenseService.createEqualSplits.mockResolvedValue(mockSplits);
      expenseService.create.mockResolvedValue(mockExpense);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses',
        payload: { amount: 100, category: 'food', expenseDate: '2025-01-01', splitEvenly: true },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(mockExpense);
      expect(expenseService.createEqualSplits).toHaveBeenCalledWith('trip-123', 100);
      expect(expenseService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ amount: 100, category: 'food', expenseDate: '2025-01-01', splits: mockSplits })
      );
    });
  });

  describe('GET /trips/:tripId/expenses', () => {
    it('should return a list of expenses for a trip', async () => {
      const mockExpenses = [
        { id: 'exp-1', amount: 50, category: 'food', expenseDate: '2025-01-01' },
        { id: 'exp-2', amount: 30, category: 'transportation', expenseDate: '2025-01-02' },
      ];
      expenseService.listByTrip.mockResolvedValue(mockExpenses);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockExpenses);
      expect(expenseService.listByTrip).toHaveBeenCalledWith('trip-123', 'user-123', {});
    });

    it('should return a list of expenses filtered by category', async () => {
      const mockExpenses = [
        { id: 'exp-1', amount: 50, category: 'food', expenseDate: '2025-01-01' },
      ];
      expenseService.listByTrip.mockResolvedValue(mockExpenses);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses?category=food',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockExpenses);
      expect(expenseService.listByTrip).toHaveBeenCalledWith('trip-123', 'user-123', { category: 'food' });
    });

    it('should return a list of expenses filtered by date range', async () => {
      const mockExpenses = [
        { id: 'exp-1', amount: 50, category: 'food', expenseDate: '2025-01-01' },
      ];
      expenseService.listByTrip.mockResolvedValue(mockExpenses);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses?startDate=2025-01-01&endDate=2025-01-01',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockExpenses);
      expect(expenseService.listByTrip).toHaveBeenCalledWith('trip-123', 'user-123', {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
      });
    });
  });

  describe('GET /trips/:tripId/expenses/summary', () => {
    it('should return an expense summary for a trip', async () => {
      const mockSummary = {
        totalExpenses: 1000,
        currency: 'USD',
        categoryBreakdown: [{ category: 'food', amount: 500 }],
      };
      expenseService.getSummary.mockResolvedValue(mockSummary);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses/summary',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockSummary);
      expect(expenseService.getSummary).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });

  describe('GET /trips/:tripId/expenses/balances', () => {
    it('should return the balance sheet for a trip', async () => {
      const mockBalances = [
        { payer: 'user-1', payee: 'user-2', amount: 50 },
      ];
      expenseService.getBalances.mockResolvedValue(mockBalances);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses/balances',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockBalances);
      expect(expenseService.getBalances).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });

  describe('GET /trips/:tripId/expenses/:expenseId', () => {
    it('should return a single expense by ID', async () => {
      const mockExpense = { id: 'expense-123', amount: 100, category: 'food' };
      expenseService.get.mockResolvedValue(mockExpense);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses/expense-123',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockExpense);
      expect(expenseService.get).toHaveBeenCalledWith('expense-123', 'user-123');
    });

    it('should return 404 if expense is not found', async () => {
      expenseService.get.mockImplementation(() => {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/expenses/non-existent-expense',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Expense not found');
    });
  });

  describe('PATCH /trips/:tripId/expenses/:expenseId', () => {
    it('should update an expense', async () => {
      const updatedExpense = { id: 'expense-123', amount: 150, category: 'transportation' };
      expenseService.update.mockResolvedValue(updatedExpense);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/expenses/expense-123',
        payload: { amount: 150, category: 'transportation' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(updatedExpense);
      expect(expenseService.update).toHaveBeenCalledWith(
        'expense-123',
        'user-123',
        { amount: 150, category: 'transportation' }
      );
    });

    it('should return 404 if expense to update is not found', async () => {
      expenseService.update.mockImplementation(() => {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123/expenses/non-existent-expense',
        payload: { amount: 150 },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Expense not found');
    });
  });

  describe('DELETE /trips/:tripId/expenses/:expenseId', () => {
    it('should delete an expense', async () => {
      expenseService.deleteExpense.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/expenses/expense-123',
      });

      expect(response.statusCode).toBe(204);
      expect(expenseService.deleteExpense).toHaveBeenCalledWith('expense-123', 'user-123');
    });

    it('should return 404 if expense to delete is not found', async () => {
      expenseService.deleteExpense.mockImplementation(() => {
        const error = new Error('Expense not found');
        error.statusCode = 404;
        throw error;
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123/expenses/non-existent-expense',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Expense not found');
    });
  });

  describe('POST /trips/:tripId/expenses/splits/:splitId/settle', () => {
    it('should mark a split as settled', async () => {
      const mockSplit = { id: 'split-123', isSettled: true };
      expenseService.settleSplit.mockResolvedValue(mockSplit);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses/splits/split-123/settle',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockSplit);
      expect(expenseService.settleSplit).toHaveBeenCalledWith('split-123', 'user-123');
    });

    it('should return 404 if split to settle is not found', async () => {
      expenseService.settleSplit.mockImplementation(() => {
        const error = new Error('Split not found');
        error.statusCode = 404;
        throw error;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses/splits/non-existent-split/settle',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Split not found');
    });
  });

  describe('POST /trips/:tripId/expenses/splits/:splitId/unsettle', () => {
    it('should mark a split as unsettled', async () => {
      const mockSplit = { id: 'split-123', isSettled: false };
      expenseService.unsettleSplit.mockResolvedValue(mockSplit);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses/splits/split-123/unsettle',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockSplit);
      expect(expenseService.unsettleSplit).toHaveBeenCalledWith('split-123', 'user-123');
    });

    it('should return 404 if split to unsettle is not found', async () => {
      expenseService.unsettleSplit.mockImplementation(() => {
        const error = new Error('Split not found');
        error.statusCode = 404;
        throw error;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/expenses/splits/non-existent-split/unsettle',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Split not found');
    });
  });
});
