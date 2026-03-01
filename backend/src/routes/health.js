// T037: Health check endpoint
import { query } from '../db/connection.js';

/**
 * Health check routes
 */
export default async function healthRoutes(fastify) {
  /**
   * Basic health check
   */
  fastify.get('/health', { schema: { tags: ['health'] } }, async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  /**
   * Detailed health check with database status
   */
  fastify.get('/health/detailed', { schema: { tags: ['health'] } }, async (request, reply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: 'unknown',
      },
    };

    // Check database connection
    try {
      const result = await query('SELECT NOW() as time');
      health.checks.database = 'ok';
      health.checks.databaseTime = result.rows[0].time;
    } catch (error) {
      health.status = 'degraded';
      health.checks.database = 'error';
      health.checks.databaseError = error.message;
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return reply.code(statusCode).send(health);
  });

  /**
   * Readiness check (for container orchestration)
   */
  fastify.get('/health/ready', { schema: { tags: ['health'] } }, async (request, reply) => {
    try {
      await query('SELECT 1');
      return reply.code(200).send({ ready: true });
    } catch (error) {
      return reply.code(503).send({
        ready: false,
        error: error.message,
      });
    }
  });

  /**
   * Liveness check (for container orchestration)
   */
  fastify.get('/health/live', { schema: { tags: ['health'] } }, async (request, reply) => {
    return { alive: true };
  });
}
