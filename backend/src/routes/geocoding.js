// T011: Geocoding route handler (GET /api/v1/geocoding/search)
import { getGeocodingService } from '../services/geocoding-service.js';
import { routeRateLimits } from '../middleware/rate-limit.js';
import { generateETag, checkNotModified } from '../middleware/cache.js';

/**
 * Register geocoding routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} opts - Plugin options
 */
export default async function geocodingRoutes(fastify, opts) {
  const geocodingService = getGeocodingService();

  /**
   * GET /api/v1/geocoding/search
   * Search for destinations using Nominatim API
   */
  fastify.get(
    '/search',
    {
      ...routeRateLimits.geocoding, // Apply geocoding rate limits (60 req/min)
      schema: {
        description: 'Search for destinations (cities, regions, countries)',
        tags: ['geocoding'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              minLength: 2,
              description: 'Search query (minimum 2 characters)',
              examples: ['Paris', 'Tokyo', 'New York'],
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 5,
              description: 'Maximum number of results',
            },
            language: {
              type: 'string',
              default: 'en',
              description: 'Language for results (ISO 639-1 code)',
              examples: ['en', 'fr', 'es', 'de'],
            },
          },
        },
        response: {
          200: {
            description: 'Search results',
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    place_id: { type: 'number' },
                    display_name: { type: 'string' },
                    lat: { type: 'number' },
                    lon: { type: 'number' },
                    type: { type: 'string' },
                    address: { type: 'object' },
                    validated: { type: 'boolean' },
                  },
                },
              },
              cached: { type: 'boolean' },
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
      const { q: query, limit, language } = request.query;

      try {
        // Search for destinations
        const result = await geocodingService.search(query, {
          limit,
          language,
        });

        // Log cache hit/miss for monitoring
        if (result.cached) {
          request.log.debug({ query, cached: true }, 'Geocoding cache hit');
        } else {
          request.log.info(
            { query, resultCount: result.results.length },
            'Nominatim API call'
          );
        }

        const etag = generateETag(result);
        if (checkNotModified(request, etag)) {
          return reply.code(304).send();
        }
        reply.setSharedCache(etag);

        return reply.code(200).send(result);
      } catch (error) {
        request.log.error({ error, query }, 'Geocoding search failed');

        // Handle validation errors
        if (error.message.includes('at least 2 characters')) {
          return reply.code(400).send({
            error: 'Bad Request',
            message: error.message,
            statusCode: 400,
          });
        }

        // Handle rate limit errors
        if (error.message.includes('rate limit')) {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: error.message,
            statusCode: 429,
          });
        }

        // Handle service unavailable errors
        const errorMsg = error.message.toLowerCase();
        if (
          errorMsg.includes('unavailable') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('timed out')
        ) {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message:
              'Geocoding service is temporarily unavailable. Please try again later.',
            statusCode: 503,
          });
        }

        // Generic error
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to search for destinations',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/v1/geocoding/health
   * Health check for geocoding service
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check geocoding service health and cache statistics',
        tags: ['geocoding'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              cache: {
                type: 'object',
                properties: {
                  size: { type: 'number' },
                  maxSize: { type: 'number' },
                  hitRate: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const stats = geocodingService.getCacheStats();

      return reply.code(200).send({
        status: 'healthy',
        cache: stats,
      });
    }
  );
}
