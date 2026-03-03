// Weather forecast route handler (GET /api/v1/weather/forecast)
import { getWeatherService } from '../services/weather-service.js';
import { routeRateLimits } from '../middleware/rate-limit.js';
import { generateETag, checkNotModified } from '../middleware/cache.js';

/**
 * Register weather routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} opts - Plugin options
 */
export default async function weatherRoutes(fastify, opts) {
  const weatherService = getWeatherService();

  /**
   * GET /api/v1/weather/forecast
   * Get weather forecast for a location and date range
   */
  fastify.get(
    '/forecast',
    {
      ...routeRateLimits.geocoding, // Reuse geocoding rate limits (60 req/min)
      schema: {
        description: 'Get weather forecast for a destination and date range',
        tags: ['weather'],
        querystring: {
          type: 'object',
          required: ['lat', 'lon', 'startDate', 'endDate'],
          properties: {
            lat: {
              type: 'number',
              minimum: -90,
              maximum: 90,
              description: 'Latitude',
            },
            lon: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              description: 'Longitude',
            },
            startDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Start date (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'End date (YYYY-MM-DD)',
            },
          },
        },
        response: {
          200: {
            description: 'Weather forecast data',
            type: 'object',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    tempMax: { type: 'number', nullable: true },
                    tempMin: { type: 'number', nullable: true },
                    weatherCode: { type: 'integer', nullable: true },
                    precipitation: { type: 'number', nullable: true },
                    source: { type: 'string', enum: ['forecast', 'climate'] },
                  },
                },
              },
              source: { type: 'string' },
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
      const { lat, lon, startDate, endDate } = request.query;

      try {
        const result = await weatherService.getForecast(lat, lon, startDate, endDate);

        if (result.cached) {
          request.log.debug({ lat, lon, cached: true }, 'Weather cache hit');
        } else {
          request.log.info(
            { lat, lon, dayCount: result.days.length },
            'Open-Meteo API call'
          );
        }

        const etag = generateETag(result);
        if (checkNotModified(request, etag)) {
          return reply.code(304).send();
        }
        reply.setSharedCache(etag);

        return reply.code(200).send(result);
      } catch (error) {
        request.log.error({ error, lat, lon }, 'Weather forecast failed');

        if (error.message.includes('rate limit')) {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: error.message,
            statusCode: 429,
          });
        }

        const errorMsg = error.message.toLowerCase();
        if (
          errorMsg.includes('unavailable') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('timed out')
        ) {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message:
              'Weather service is temporarily unavailable. Please try again later.',
            statusCode: 503,
          });
        }

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch weather forecast',
          statusCode: 500,
        });
      }
    }
  );
}
