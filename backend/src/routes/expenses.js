// T213 & T214: Expense routes - CRUD and summary endpoints
import * as expenseService from '../services/expense-service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';

const tripIdSchema = {
  type: 'object',
  required: ['tripId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const expenseIdSchema = {
  type: 'object',
  required: ['tripId', 'expenseId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
    expenseId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const splitIdSchema = {
  type: 'object',
  required: ['tripId', 'splitId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
    splitId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const createExpenseSchema = {
  type: 'object',
  required: ['amount', 'category', 'expenseDate'],
  properties: {
    payerId: {
      type: 'string',
      format: 'uuid',
    },
    activityId: {
      type: 'string',
      format: 'uuid',
    },
    amount: {
      type: 'number',
      minimum: 0.01,
    },
    currency: {
      type: 'string',
      maxLength: 3,
    },
    category: {
      type: 'string',
      enum: ['accommodation', 'transportation', 'food', 'activities', 'shopping', 'entertainment', 'settlement', 'other'],
    },
    description: {
      type: 'string',
      maxLength: 500,
    },
    expenseDate: {
      type: 'string',
      format: 'date',
    },
    splits: {
      type: 'array',
      items: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
          },
          amount: {
            type: 'number',
            minimum: 0,
          },
          percentage: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
        },
      },
    },
    splitEvenly: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
};

const updateExpenseSchema = {
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      minimum: 0.01,
    },
    currency: {
      type: 'string',
      maxLength: 3,
    },
    category: {
      type: 'string',
      enum: ['accommodation', 'transportation', 'food', 'activities', 'shopping', 'entertainment', 'settlement', 'other'],
    },
    description: {
      type: 'string',
      maxLength: 500,
    },
    expenseDate: {
      type: 'string',
      format: 'date',
    },
    activityId: {
      type: ['string', 'null'],
      format: 'uuid',
    },
    splits: {
      type: 'array',
      items: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
          },
          amount: {
            type: 'number',
            minimum: 0,
          },
          percentage: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
        },
      },
    },
  },
  additionalProperties: false,
};

export default async function expenseRoutes(fastify) {
  /**
   * Create a new expense
   * POST /trips/:tripId/expenses
   */
  fastify.post(
    '/trips/:tripId/expenses',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(createExpenseSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const expenseData = { ...request.body };

      // If splitEvenly is true, create equal splits for all participants
      if (expenseData.splitEvenly) {
        expenseData.splits = await expenseService.createEqualSplits(tripId, expenseData.amount);
        delete expenseData.splitEvenly;
      }

      const expense = await expenseService.create(tripId, request.user.userId, expenseData);
      reply.code(201).send(expense);
    })
  );

  /**
   * Get all expenses for a trip
   * GET /trips/:tripId/expenses
   */
  fastify.get(
    '/trips/:tripId/expenses',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const { category, startDate, endDate } = request.query;

      const expenses = await expenseService.listByTrip(tripId, request.user.userId, {
        category,
        startDate,
        endDate,
      });
      reply.send(expenses);
    })
  );

  /**
   * Get expense summary for a trip
   * GET /trips/:tripId/expenses/summary
   */
  fastify.get(
    '/trips/:tripId/expenses/summary',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const summary = await expenseService.getSummary(tripId, request.user.userId);
      reply.send(summary);
    })
  );

  /**
   * Get balance sheet for a trip
   * GET /trips/:tripId/expenses/balances
   */
  fastify.get(
    '/trips/:tripId/expenses/balances',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const balances = await expenseService.getBalances(tripId, request.user.userId);
      reply.send(balances);
    })
  );

  /**
   * Get a single expense
   * GET /trips/:tripId/expenses/:expenseId
   */
  fastify.get(
    '/trips/:tripId/expenses/:expenseId',
    {
      preHandler: [authenticate, validateParams(expenseIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { expenseId } = request.params;
      const expense = await expenseService.get(expenseId, request.user.userId);
      reply.send(expense);
    })
  );

  /**
   * Update an expense
   * PATCH /trips/:tripId/expenses/:expenseId
   */
  fastify.patch(
    '/trips/:tripId/expenses/:expenseId',
    {
      preHandler: [authenticate, validateParams(expenseIdSchema), validateBody(updateExpenseSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { expenseId } = request.params;
      const expense = await expenseService.update(expenseId, request.user.userId, request.body);
      reply.send(expense);
    })
  );

  /**
   * Delete an expense
   * DELETE /trips/:tripId/expenses/:expenseId
   */
  fastify.delete(
    '/trips/:tripId/expenses/:expenseId',
    {
      preHandler: [authenticate, validateParams(expenseIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { expenseId } = request.params;
      await expenseService.deleteExpense(expenseId, request.user.userId);
      reply.code(204).send();
    })
  );

  /**
   * Mark a split as settled
   * POST /trips/:tripId/expenses/splits/:splitId/settle
   */
  fastify.post(
    '/trips/:tripId/expenses/splits/:splitId/settle',
    {
      preHandler: [authenticate, validateParams(splitIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { splitId } = request.params;
      const split = await expenseService.settleSplit(splitId, request.user.userId);
      reply.send(split);
    })
  );

  /**
   * Mark a split as unsettled
   * POST /trips/:tripId/expenses/splits/:splitId/unsettle
   */
  fastify.post(
    '/trips/:tripId/expenses/splits/:splitId/unsettle',
    {
      preHandler: [authenticate, validateParams(splitIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { splitId } = request.params;
      const split = await expenseService.unsettleSplit(splitId, request.user.userId);
      reply.send(split);
    })
  );
}
