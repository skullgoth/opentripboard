// T025: Cover Image route handler (POST /api/v1/cover-images/fetch)
import { getCoverImageService } from '../services/cover-image-service.js';
import { routeRateLimits } from '../middleware/rate-limit.js';

/**
 * Register cover image routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} opts - Plugin options
 */
export default async function coverImageRoutes(fastify, opts) {
  const coverImageService = getCoverImageService();

  /**
   * POST /api/v1/cover-images/fetch
   * Fetch cover image for destination
   */
  fastify.post(
    '/fetch',
    {
      ...routeRateLimits.coverImages, // Apply cover image rate limits
      schema: {
        description: 'Fetch cover image for destination from Pexels',
        tags: ['cover-images'],
        body: {
          type: 'object',
          required: ['destination', 'tripId'],
          properties: {
            destination: {
              type: 'string',
              minLength: 1,
              description: 'Destination name (from destination_data.display_name)',
              examples: ['Paris, France', 'Tokyo, Japan'],
            },
            tripId: {
              type: 'string',
              format: 'uuid',
              description: 'Trip ID for filename',
            },
          },
        },
        response: {
          200: {
            description: 'Cover image fetched successfully',
            type: 'object',
            properties: {
              url: { type: 'string' },
              attribution: {
                type: 'object',
                properties: {
                  source: { type: 'string' },
                  photographer: { type: 'string' },
                  photographerUrl: { type: 'string' },
                  photoUrl: { type: 'string' },
                  photoId: { type: 'number' },
                },
              },
              source: { type: 'string' },
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
      const { destination, tripId } = request.body;

      try {
        // Fetch cover image
        const result = await coverImageService.fetchCoverImage(destination, {
          tripId,
        });

        request.log.info(
          { destination, tripId, photographer: result.attribution.photographer },
          'Cover image fetched from Pexels'
        );

        return reply.code(200).send(result);
      } catch (error) {
        request.log.error({ error, destination, tripId }, 'Cover image fetch failed');

        // Handle specific error types
        if (error.message === 'PEXELS_API_NOT_CONFIGURED') {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: 'Cover image service is not configured',
            statusCode: 503,
          });
        }

        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'Cover image service rate limit exceeded. Please try again later.',
            statusCode: 429,
          });
        }

        if (error.message === 'NO_IMAGES_FOUND') {
          return reply.code(404).send({
            error: 'Not Found',
            message: `No cover images found for destination: ${destination}`,
            statusCode: 404,
          });
        }

        if (error.message === 'REQUEST_TIMEOUT') {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: 'Cover image service timed out. Please try again later.',
            statusCode: 503,
          });
        }

        // Generic error
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch cover image',
          statusCode: 500,
        });
      }
    }
  );

  /**
   * GET /api/v1/cover-images/health
   * Health check for cover image service
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check cover image service health and rate limit statistics',
        tags: ['cover-images'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              configured: { type: 'boolean' },
              rateLimit: {
                type: 'object',
                properties: {
                  requestsInLastHour: { type: 'number' },
                  maxRequestsPerHour: { type: 'number' },
                  remaining: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const stats = coverImageService.getRateLimitStats();
      const configured = !!process.env.PEXELS_API_KEY;

      return reply.code(200).send({
        status: 'healthy',
        configured,
        rateLimit: stats,
      });
    }
  );
}
