/**
 * T099: TripBuddy routes - invite, accept, manage trip-buddies
 */
import * as tripBuddyService from '../services/trip-buddy-service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';

// Schemas for validation

const inviteTripBuddySchema = {
  type: 'object',
  required: ['email', 'role'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    role: {
      type: 'string',
      enum: ['editor', 'viewer'],
    },
  },
  additionalProperties: false,
};

const updateRoleSchema = {
  type: 'object',
  required: ['role'],
  properties: {
    role: {
      type: 'string',
      enum: ['editor', 'viewer'],
    },
  },
  additionalProperties: false,
};

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

const tripBuddyIdSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
  },
};

export default async function tripBuddyRoutes(fastify) {
  /**
   * Invite a tripBuddy to a trip
   * POST /api/v1/trips/:tripId/trip-buddies
   */
  fastify.post(
    '/trips/:tripId/trip-buddies',
    {
      schema: { tags: ['buddies'], params: tripIdSchema, body: inviteTripBuddySchema },
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(inviteTripBuddySchema)],
    },
    asyncHandler(async (request, reply) => {
      const tripBuddy = await tripBuddyService.inviteTripBuddy(
        request.params.tripId,
        request.user.userId,
        request.body.email,
        request.body.role
      );
      reply.code(201).send(tripBuddy);
    })
  );

  /**
   * Get all trip-buddies for a trip
   * GET /api/v1/trips/:tripId/trip-buddies
   */
  fastify.get(
    '/trips/:tripId/trip-buddies',
    {
      schema: { tags: ['buddies'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const tripBuddies = await tripBuddyService.getTripBuddies(
        request.params.tripId,
        request.user.userId
      );
      reply.send(tripBuddies);
    })
  );

  /**
   * Get pending invitations for current user
   * GET /api/v1/trip-buddies/invitations
   */
  fastify.get(
    '/trip-buddies/invitations',
    {
      schema: { tags: ['buddies'] },
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const invitations = await tripBuddyService.getPendingInvitations(request.user.userId);
      reply.send(invitations);
    })
  );

  /**
   * Accept a collaboration invitation
   * POST /api/v1/trip-buddies/:id/accept
   */
  fastify.post(
    '/trip-buddies/:id/accept',
    {
      schema: { tags: ['buddies'], params: tripBuddyIdSchema },
      preHandler: [authenticate, validateParams(tripBuddyIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const tripBuddy = await tripBuddyService.acceptInvitation(
        request.params.id,
        request.user.userId
      );
      reply.send(tripBuddy);
    })
  );

  /**
   * Update tripBuddy role
   * PATCH /api/v1/trip-buddies/:id
   */
  fastify.patch(
    '/trip-buddies/:id',
    {
      schema: { tags: ['buddies'], params: tripBuddyIdSchema, body: updateRoleSchema },
      preHandler: [authenticate, validateParams(tripBuddyIdSchema), validateBody(updateRoleSchema)],
    },
    asyncHandler(async (request, reply) => {
      const tripBuddy = await tripBuddyService.updateRole(
        request.params.id,
        request.user.userId,
        request.body.role
      );
      reply.send(tripBuddy);
    })
  );

  /**
   * Remove a tripBuddy from a trip
   * DELETE /api/v1/trip-buddies/:id
   */
  fastify.delete(
    '/trip-buddies/:id',
    {
      schema: { tags: ['buddies'], params: tripBuddyIdSchema },
      preHandler: [authenticate, validateParams(tripBuddyIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await tripBuddyService.removeTripBuddy(
        request.params.id,
        request.user.userId
      );
      reply.code(204).send();
    })
  );

  /**
   * Leave a trip (remove self as tripBuddy)
   * POST /api/v1/trips/:tripId/leave
   */
  fastify.post(
    '/trips/:tripId/leave',
    {
      schema: { tags: ['buddies'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await tripBuddyService.leaveTrip(
        request.params.tripId,
        request.user.userId
      );
      reply.code(204).send();
    })
  );

  /**
   * Get collaboration statistics for a trip
   * GET /api/v1/trips/:tripId/trip-buddies/stats
   */
  fastify.get(
    '/trips/:tripId/trip-buddies/stats',
    {
      schema: { tags: ['buddies'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const stats = await tripBuddyService.getCollaborationStats(
        request.params.tripId,
        request.user.userId
      );
      reply.send(stats);
    })
  );

  /**
   * Check user's role on a trip
   * GET /api/v1/trips/:tripId/role
   */
  fastify.get(
    '/trips/:tripId/role',
    {
      schema: { tags: ['buddies'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const role = await tripBuddyService.getUserRole(
        request.params.tripId,
        request.user.userId
      );
      reply.send({ role });
    })
  );
}
