// Transport routing route handler (GET /api/v1/routing)
import { getRoutingService, getValidTransportModes } from '../services/routing-service.js';
import { routeRateLimits } from '../middleware/rate-limit.js';

const VALID_MODES = getValidTransportModes();

/**
 * Register routing routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} opts - Plugin options
 */
export default async function routingRoutes(fastify, opts) {
  const routingService = getRoutingService();

  /**
   * GET /api/v1/routing
   * Get route between two points with specified transport mode
   */
  fastify.get(
    '/',
    {
      ...routeRateLimits.geocoding, // Reuse geocoding rate limits (60 req/min)
      schema: {
        description: 'Get route between two points',
        tags: ['routing'],
        querystring: {
          type: 'object',
          required: ['fromLat', 'fromLng', 'toLat', 'toLng', 'mode'],
          properties: {
            fromLat: {
              type: 'number',
              minimum: -90,
              maximum: 90,
              description: 'Origin latitude',
            },
            fromLng: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              description: 'Origin longitude',
            },
            toLat: {
              type: 'number',
              minimum: -90,
              maximum: 90,
              description: 'Destination latitude',
            },
            toLng: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              description: 'Destination longitude',
            },
            mode: {
              type: 'string',
              enum: VALID_MODES,
              description: 'Transport mode (walk, bike, drive, fly, boat)',
            },
          },
        },
        response: {
          200: {
            description: 'Route data',
            type: 'object',
            properties: {
              distance: {
                type: 'number',
                description: 'Distance in kilometers',
              },
              duration: {
                type: 'number',
                description: 'Duration in minutes',
              },
              geometry: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'number' },
                },
                description: 'GeoJSON coordinates array [lng, lat]',
              },
              provider: {
                type: 'string',
                enum: ['osrm', 'haversine'],
                description: 'Routing provider used',
              },
              cached: {
                type: 'boolean',
                description: 'Whether result was from cache',
              },
            },
          },
          400: {
            description: 'Invalid request',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          429: {
            description: 'Rate limit exceeded',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          503: {
            description: 'Service unavailable',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { fromLat, fromLng, toLat, toLng, mode } = request.query;

      try {
        const result = await routingService.getRoute(fromLat, fromLng, toLat, toLng, mode);

        // Log cache hit/miss
        if (result.cached) {
          request.log.debug({ mode, cached: true }, 'Routing cache hit');
        } else {
          request.log.info(
            { mode, provider: result.provider, distance: result.distance },
            'Route calculated'
          );
        }

        return reply.code(200).send(result);
      } catch (error) {
        request.log.error({ error, mode }, 'Routing request failed');

        // Handle validation errors
        if (error.message.includes('Invalid')) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: error.message,
            statusCode: 400,
          });
        }

        // Handle rate limit errors
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'Routing service rate limit exceeded. Please try again later.',
            statusCode: 429,
          });
        }

        // Handle service unavailable errors
        if (error.message === 'SERVICE_UNAVAILABLE') {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: 'Routing service is temporarily unavailable. Please try again later.',
            statusCode: 503,
          });
        }

        // Generic error
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to calculate route',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/v1/routing/health
   * Health check for routing service
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check routing service health and cache statistics',
        tags: ['routing'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              modes: {
                type: 'array',
                items: { type: 'string' },
              },
              cache: {
                type: 'object',
                properties: {
                  size: { type: 'number' },
                  maxSize: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const stats = routingService.getCacheStats();

      return reply.code(200).send({
        status: 'healthy',
        modes: VALID_MODES,
        cache: stats,
      });
    }
  );
}
