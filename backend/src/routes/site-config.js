// Site configuration routes
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error-handler.js';
import siteConfigService from '../services/site-config-service.js';

export default async function siteConfigRoutes(fastify) {
  /**
   * GET /api/v1/site-config/public
   * Public endpoint - returns site settings needed by frontend
   * No authentication required
   */
  fastify.get(
    '/site-config/public',
    asyncHandler(async (request, reply) => {
      const settings = await siteConfigService.getPublicSettings();

      // Cache for 5 minutes on client side
      reply.header('Cache-Control', 'public, max-age=300');

      return {
        success: true,
        data: settings,
      };
    })
  );

  /**
   * GET /api/v1/admin/site-config
   * Admin endpoint - returns all site configuration
   */
  fastify.get(
    '/admin/site-config',
    {
      preHandler: [fastify.auth, requireAdmin],
    },
    asyncHandler(async (request, reply) => {
      const registrationEnabled = await siteConfigService.getRegistrationEnabled();

      return {
        success: true,
        data: {
          registrationEnabled,
        },
      };
    })
  );

  /**
   * PATCH /api/v1/admin/site-config
   * Admin endpoint - update site configuration
   */
  fastify.patch(
    '/admin/site-config',
    {
      preHandler: [fastify.auth, requireAdmin],
      schema: {
        body: {
          type: 'object',
          properties: {
            registrationEnabled: { type: 'boolean' },
          },
          minProperties: 1,
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const { registrationEnabled } = request.body;

      if (registrationEnabled !== undefined) {
        await siteConfigService.updateRegistrationEnabled(registrationEnabled);
      }

      // Return updated config
      const config = await siteConfigService.getRegistrationEnabled();

      return {
        success: true,
        data: {
          registrationEnabled: config,
        },
        message: 'Site configuration updated',
      };
    })
  );
}
