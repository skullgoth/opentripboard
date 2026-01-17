// T069: Activity routes - CRUD operations
import * as activityService from '../services/activity-service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { broadcastToRoom } from '../websocket/rooms.js';

// All valid activity/reservation types:
// Lodging: hotel, rental
// Transport: bus, car, cruise, ferry, flight, train
// Dining: bar, restaurant
// Activities: market, monument, museum, park, shopping, sightseeing
const ALL_TYPES = [
  // Lodging
  'hotel', 'rental',
  // Transport
  'bus', 'car', 'cruise', 'ferry', 'flight', 'train',
  // Dining
  'bar', 'restaurant',
  // Activities
  'market', 'monument', 'museum', 'park', 'shopping', 'sightseeing',
  // Legacy types (for backward compatibility)
  'accommodation', 'transportation', 'attraction', 'meeting', 'event', 'other',
];

const createActivitySchema = {
  type: 'object',
  required: ['type', 'title'],
  properties: {
    type: {
      type: 'string',
      enum: ALL_TYPES,
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    description: {
      type: 'string',
    },
    location: {
      type: 'string',
      maxLength: 255,
    },
    latitude: {
      type: 'number',
      minimum: -90,
      maximum: 90,
    },
    longitude: {
      type: 'number',
      minimum: -180,
      maximum: 180,
    },
    startTime: {
      type: 'string',
      format: 'date-time',
    },
    endTime: {
      type: 'string',
      format: 'date-time',
    },
    orderIndex: {
      type: 'integer',
      minimum: 0,
    },
    metadata: {
      type: 'object',
    },
  },
  additionalProperties: false,
};

const updateActivitySchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ALL_TYPES,
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    description: {
      type: 'string',
    },
    location: {
      type: 'string',
      maxLength: 255,
    },
    latitude: {
      type: 'number',
      minimum: -90,
      maximum: 90,
    },
    longitude: {
      type: 'number',
      minimum: -180,
      maximum: 180,
    },
    startTime: {
      type: 'string',
      format: 'date-time',
    },
    endTime: {
      type: 'string',
      format: 'date-time',
    },
    orderIndex: {
      type: 'integer',
      minimum: 0,
    },
    metadata: {
      type: 'object',
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

const activityIdSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const reorderSchema = {
  type: 'object',
  required: ['order'],
  properties: {
    order: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'orderIndex'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          orderIndex: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
};

export default async function activityRoutes(fastify) {
  /**
   * Create a new activity for a trip
   */
  fastify.post(
    '/trips/:tripId/activities',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(createActivitySchema)],
    },
    asyncHandler(async (request, reply) => {
      const activity = await activityService.create(
        request.params.tripId,
        request.user.userId,
        request.body
      );

      // T154: Broadcast activity creation to all users in the trip room via WebSocket
      // Don't exclude creator - they may have multiple tabs open
      broadcastToRoom(
        request.params.tripId,
        {
          type: 'activity:created',
          activity,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.code(201).send(activity);
    })
  );

  /**
   * Get all activities for a trip
   */
  fastify.get(
    '/trips/:tripId/activities',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const activities = await activityService.listByTrip(
        request.params.tripId,
        request.user.userId
      );
      reply.send(activities);
    })
  );

  /**
   * Get activity by ID
   */
  fastify.get(
    '/activities/:id',
    {
      preHandler: [authenticate, validateParams(activityIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const activity = await activityService.get(request.params.id, request.user.userId);
      reply.send(activity);
    })
  );

  /**
   * Update activity
   */
  fastify.patch(
    '/activities/:id',
    {
      preHandler: [authenticate, validateParams(activityIdSchema), validateBody(updateActivitySchema)],
    },
    asyncHandler(async (request, reply) => {
      const activity = await activityService.update(
        request.params.id,
        request.user.userId,
        request.body
      );

      // T154: Broadcast activity update to all users in the trip room via WebSocket
      // Don't exclude updater - they may have multiple tabs open
      broadcastToRoom(
        activity.tripId,
        {
          type: 'activity:updated',
          activityId: activity.id,
          activity,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(activity);
    })
  );

  /**
   * Delete activity
   */
  fastify.delete(
    '/activities/:id',
    {
      preHandler: [authenticate, validateParams(activityIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      // T154: Get activity before deleting to get tripId for WebSocket broadcast
      const activity = await activityService.get(request.params.id, request.user.userId);
      const tripId = activity.tripId;
      const activityId = activity.id;

      await activityService.deleteActivity(request.params.id, request.user.userId);

      // T154: Broadcast activity deletion to all users in the trip room via WebSocket
      // Don't exclude deleter - they may have multiple tabs open
      broadcastToRoom(
        tripId,
        {
          type: 'activity:deleted',
          activityId,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.code(204).send();
    })
  );

  /**
   * Reorder activities in a trip
   */
  fastify.post(
    '/trips/:tripId/activities/reorder',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(reorderSchema)],
    },
    asyncHandler(async (request, reply) => {
      const activities = await activityService.reorder(
        request.params.tripId,
        request.user.userId,
        request.body.order
      );

      // T154: Broadcast activity reorder to all users in the trip room via WebSocket
      // Don't exclude reorderer - they may have multiple tabs open
      broadcastToRoom(
        request.params.tripId,
        {
          type: 'activity:reordered',
          activities,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(activities);
    })
  );
}
