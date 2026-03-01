// Categories API routes

import categoryService from '../services/category-service.js';
import { getDefaultCategories } from '../utils/default-categories.js';
import { authenticate } from '../middleware/auth.js';
import { findById as getTripById } from '../db/queries/trips.js';

/**
 * Categories routes plugin
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function categoriesRoutes(fastify) {
  // Schema for category object
  const categorySchema = {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      icon: { type: 'string' },
      domain: { type: 'string', enum: ['activity', 'reservation', 'expense', 'document'] },
      isCustom: { type: 'boolean' },
      ref: { type: 'string' },
    },
  };

  // Schema for default category
  const defaultCategorySchema = {
    type: 'object',
    properties: {
      key: { type: 'string' },
      icon: { type: 'string' },
      i18nKey: { type: 'string' },
      group: { type: 'string' },
    },
  };

  // GET /api/v1/categories - Get user's categories (defaults + custom)
  fastify.get(
    '/categories',
    {
      schema: { tags: ['categories'] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const categories = await categoryService.getCategories(userId);

      // Prevent caching
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');

      return {
        success: true,
        data: categories,
      };
    }
  );

  // GET /api/v1/categories/defaults - Get default categories only (no auth required)
  fastify.get(
    '/categories/defaults',
    {
      schema: {
        tags: ['categories'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const defaults = getDefaultCategories();

      // Cache for 1 hour - defaults don't change
      reply.header('Cache-Control', 'public, max-age=3600');

      return {
        success: true,
        data: defaults,
      };
    }
  );

  // POST /api/v1/categories - Create a new custom category
  fastify.post(
    '/categories',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['categories'],
        body: {
          type: 'object',
          required: ['name', 'icon', 'domain'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 50 },
            icon: { type: 'string', minLength: 1, maxLength: 10 },
            domain: { type: 'string', enum: ['activity', 'reservation', 'expense', 'document'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: categorySchema,
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { name, icon, domain } = request.body;

      const category = await categoryService.createCategory(userId, { name, icon, domain });

      reply.code(201);
      return {
        success: true,
        data: category,
        message: 'Category created successfully',
      };
    }
  );

  // PUT /api/v1/categories/:id - Update a custom category
  fastify.put(
    '/categories/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['categories'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 50 },
            icon: { type: 'string', minLength: 1, maxLength: 10 },
          },
          minProperties: 1,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: categorySchema,
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { id } = request.params;
      const updates = request.body;

      const category = await categoryService.updateCategory(userId, id, updates);

      return {
        success: true,
        data: category,
        message: 'Category updated successfully',
      };
    }
  );

  // DELETE /api/v1/categories/:id - Delete a custom category
  fastify.delete(
    '/categories/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['categories'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  reassigned: {
                    type: 'object',
                    properties: {
                      expenses: { type: 'integer' },
                      activities: { type: 'integer' },
                      reservations: { type: 'integer' },
                      documents: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { id } = request.params;

      const result = await categoryService.deleteCategory(userId, id);

      return {
        success: true,
        message: 'Category deleted successfully',
        data: {
          reassigned: result.reassigned,
        },
      };
    }
  );

  // GET /api/v1/categories/:id/usage - Get usage count for a category
  fastify.get(
    '/categories/:id/usage',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['categories'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  expenses: { type: 'integer' },
                  activities: { type: 'integer' },
                  reservations: { type: 'integer' },
                  documents: { type: 'integer' },
                  total: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { id } = request.params;

      const usage = await categoryService.getUsageCount(userId, id);

      return {
        success: true,
        data: usage,
      };
    }
  );

  // GET /api/v1/trips/:tripId/categories - Get categories for a trip (owner's categories)
  fastify.get(
    '/trips/:tripId/categories',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['categories'],
        params: {
          type: 'object',
          required: ['tripId'],
          properties: {
            tripId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { tripId } = request.params;

      // Get the trip to find the owner
      const trip = await getTripById(tripId, userId);
      if (!trip) {
        const error = new Error('Trip not found');
        error.statusCode = 404;
        throw error;
      }

      // Get the trip owner's categories (for collaborator access)
      const categories = await categoryService.getTripCategories(trip.owner_id);

      // Prevent caching
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');

      return {
        success: true,
        data: categories,
      };
    }
  );
}
