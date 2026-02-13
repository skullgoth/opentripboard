// Preferences API routes

import preferenceService from '../services/preference-service.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Preferences routes plugin
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function preferencesRoutes(fastify) {
  // Schema for preferences object
  const preferencesSchema = {
    type: 'object',
    additionalProperties: true,
    properties: {
      language: { type: 'string', enum: ['en', 'fr', 'es'] },
      dateFormat: { type: 'string', enum: ['mdy', 'dmy'] },
      timeFormat: { type: 'string', enum: ['12h', '24h'] },
      distanceFormat: { type: 'string', enum: ['mi', 'km'] },
      isDefault: { type: 'boolean' },
    },
  };

  // GET /api/v1/preferences - Get current user preferences
  fastify.get(
    '/preferences',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const preferences = await preferenceService.getPreferences(userId);

      // Prevent caching
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');

      return {
        success: true,
        data: preferences,
      };
    }
  );

  // PUT /api/v1/preferences - Update user preferences
  fastify.put(
    '/preferences',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['en', 'fr', 'es'] },
            dateFormat: { type: 'string', enum: ['mdy', 'dmy'] },
            timeFormat: { type: 'string', enum: ['12h', '24h'] },
            distanceFormat: { type: 'string', enum: ['mi', 'km'] },
          },
          minProperties: 1,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: preferencesSchema,
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const updates = request.body;

      const preferences = await preferenceService.updatePreferences(
        userId,
        updates
      );

      return {
        success: true,
        data: preferences,
        message: 'Preferences saved successfully',
      };
    }
  );

  // GET /api/v1/preferences/languages - Get supported languages
  fastify.get(
    '/preferences/languages',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    name: { type: 'string' },
                    nativeName: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const languages = preferenceService.getSupportedLanguages();

      reply.setCacheHeaders({ maxAge: 3600 });

      return {
        success: true,
        data: languages,
      };
    }
  );

  // GET /api/v1/preferences/defaults - Get default preferences for locale
  fastify.get(
    '/preferences/defaults',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            locale: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: preferencesSchema,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { locale } = request.query;
      const defaults = preferenceService.getDefaults(locale);

      reply.setCacheHeaders({ maxAge: 3600 });

      return {
        success: true,
        data: defaults,
      };
    }
  );
}
