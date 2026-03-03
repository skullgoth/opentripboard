// Notification routes - CRUD for user notifications
import * as notificationQueries from '../db/queries/notifications.js';
import { authenticate } from '../middleware/auth.js';
import { validateParams } from '../middleware/validation.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';

const notificationIdSchema = {
  type: 'object',
  required: ['notificationId'],
  properties: {
    notificationId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

export default async function notificationRoutes(fastify) {
  /**
   * Get user's notifications
   * GET /api/v1/notifications?limit=20&offset=0
   */
  fastify.get(
    '/notifications',
    {
      schema: { tags: ['notifications'] },
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const limit = Math.min(Math.max(parseInt(request.query.limit, 10) || 20, 1), 50);
      const offset = Math.max(parseInt(request.query.offset, 10) || 0, 0);

      const notifications = await notificationQueries.findByUserId(
        request.user.userId,
        { limit, offset }
      );
      reply.send(notifications);
    })
  );

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  fastify.get(
    '/notifications/unread-count',
    {
      schema: { tags: ['notifications'] },
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const count = await notificationQueries.countUnread(request.user.userId);
      reply.send({ count });
    })
  );

  /**
   * Mark a notification as read
   * PATCH /api/v1/notifications/:notificationId/read
   */
  fastify.patch(
    '/notifications/:notificationId/read',
    {
      schema: { tags: ['notifications'], params: notificationIdSchema },
      preHandler: [authenticate, validateParams(notificationIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const notification = await notificationQueries.markAsRead(
        request.params.notificationId,
        request.user.userId
      );

      if (!notification) {
        throw new NotFoundError('Notification');
      }

      reply.send(notification);
    })
  );

  /**
   * Mark all notifications as read
   * POST /api/v1/notifications/mark-all-read
   */
  fastify.post(
    '/notifications/mark-all-read',
    {
      schema: { tags: ['notifications'] },
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      await notificationQueries.markAllAsRead(request.user.userId);
      reply.code(204).send();
    })
  );

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:notificationId
   */
  fastify.delete(
    '/notifications/:notificationId',
    {
      schema: { tags: ['notifications'], params: notificationIdSchema },
      preHandler: [authenticate, validateParams(notificationIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const deleted = await notificationQueries.deleteNotification(
        request.params.notificationId,
        request.user.userId
      );

      if (!deleted) {
        throw new NotFoundError('Notification');
      }

      reply.code(204).send();
    })
  );
}
