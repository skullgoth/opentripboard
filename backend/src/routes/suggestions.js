/**
 * T100: Suggestion routes - create, vote, accept, reject suggestions
 */
import * as suggestionService from '../services/suggestion-service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { broadcastToRoom } from '../websocket/rooms.js';

// Schemas for validation

const createSuggestionSchema = {
  type: 'object',
  required: ['activityType', 'title'],
  properties: {
    activityType: {
      type: 'string',
      enum: ['flight', 'train', 'accommodation', 'restaurant', 'attraction', 'transportation', 'meeting', 'event', 'other'],
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
      oneOf: [
        { type: 'string' }, // Accept datetime-local format (YYYY-MM-DDTHH:mm) or ISO 8601
        { type: 'null' },
      ],
    },
    endTime: {
      oneOf: [
        { type: 'string' }, // Accept datetime-local format (YYYY-MM-DDTHH:mm) or ISO 8601
        { type: 'null' },
      ],
    },
  },
  additionalProperties: false,
};

const updateSuggestionSchema = {
  type: 'object',
  properties: {
    activityType: {
      type: 'string',
      enum: ['flight', 'train', 'accommodation', 'restaurant', 'attraction', 'transportation', 'meeting', 'event', 'other'],
    },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    description: {
      oneOf: [
        { type: 'string' },
        { type: 'null' },
      ],
    },
    location: {
      oneOf: [
        { type: 'string', maxLength: 255 },
        { type: 'null' },
      ],
    },
    latitude: {
      oneOf: [
        { type: 'number', minimum: -90, maximum: 90 },
        { type: 'null' },
      ],
    },
    longitude: {
      oneOf: [
        { type: 'number', minimum: -180, maximum: 180 },
        { type: 'null' },
      ],
    },
    startTime: {
      oneOf: [
        { type: 'string', format: 'date-time' },
        { type: 'null' },
      ],
    },
    endTime: {
      oneOf: [
        { type: 'string', format: 'date-time' },
        { type: 'null' },
      ],
    },
  },
  additionalProperties: false,
};

const voteSchema = {
  type: 'object',
  required: ['vote'],
  properties: {
    vote: {
      type: 'string',
      enum: ['up', 'down', 'neutral'],
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

const suggestionIdSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const statusQuerySchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pending', 'accepted', 'rejected'],
    },
  },
};

export default async function suggestionRoutes(fastify) {
  /**
   * Create a new suggestion
   * POST /api/v1/trips/:tripId/suggestions
   */
  fastify.post(
    '/trips/:tripId/suggestions',
    {
      schema: { tags: ['suggestions'], params: tripIdSchema, body: createSuggestionSchema },
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(createSuggestionSchema)],
    },
    asyncHandler(async (request, reply) => {
      const suggestion = await suggestionService.createSuggestion(
        request.params.tripId,
        request.user.userId,
        request.body
      );

      // Broadcast suggestion creation to all users in the trip room
      broadcastToRoom(
        request.params.tripId,
        {
          type: 'suggestion:created',
          suggestion,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.code(201).send(suggestion);
    })
  );

  /**
   * Get all suggestions for a trip
   * GET /api/v1/trips/:tripId/suggestions?status=pending
   */
  fastify.get(
    '/trips/:tripId/suggestions',
    {
      schema: { tags: ['suggestions'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const status = request.query.status || null;
      const suggestions = await suggestionService.getSuggestions(
        request.params.tripId,
        request.user.userId,
        status
      );
      reply.send(suggestions);
    })
  );

  /**
   * Get a specific suggestion
   * GET /api/v1/suggestions/:id
   */
  fastify.get(
    '/suggestions/:id',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const suggestion = await suggestionService.getSuggestion(
        request.params.id,
        request.user.userId
      );
      reply.send(suggestion);
    })
  );

  /**
   * Vote on a suggestion
   * POST /api/v1/suggestions/:id/vote
   */
  fastify.post(
    '/suggestions/:id/vote',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema, body: voteSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema), validateBody(voteSchema)],
    },
    asyncHandler(async (request, reply) => {
      const suggestion = await suggestionService.voteSuggestion(
        request.params.id,
        request.user.userId,
        request.body.vote
      );

      // Broadcast vote to all users in the trip room
      broadcastToRoom(
        suggestion.tripId,
        {
          type: 'suggestion:voted',
          suggestionId: suggestion.id,
          suggestion,
          vote: request.body.vote,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(suggestion);
    })
  );

  /**
   * Accept a suggestion (creates activity)
   * POST /api/v1/suggestions/:id/accept
   */
  fastify.post(
    '/suggestions/:id/accept',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const result = await suggestionService.acceptSuggestion(
        request.params.id,
        request.user.userId
      );

      // Broadcast acceptance to all users in the trip room
      broadcastToRoom(
        result.suggestion.tripId,
        {
          type: 'suggestion:accepted',
          suggestionId: result.suggestion.id,
          suggestion: result.suggestion,
          activity: result.activity,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(result);
    })
  );

  /**
   * Reject a suggestion
   * POST /api/v1/suggestions/:id/reject
   */
  fastify.post(
    '/suggestions/:id/reject',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const suggestion = await suggestionService.rejectSuggestion(
        request.params.id,
        request.user.userId
      );

      // Broadcast rejection to all users in the trip room
      broadcastToRoom(
        suggestion.tripId,
        {
          type: 'suggestion:rejected',
          suggestionId: suggestion.id,
          suggestion,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(suggestion);
    })
  );

  /**
   * Update a suggestion (only by creator, only if pending)
   * PATCH /api/v1/suggestions/:id
   */
  fastify.patch(
    '/suggestions/:id',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema, body: updateSuggestionSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema), validateBody(updateSuggestionSchema)],
    },
    asyncHandler(async (request, reply) => {
      const suggestion = await suggestionService.updateSuggestion(
        request.params.id,
        request.user.userId,
        request.body
      );

      // Broadcast update to all users in the trip room
      broadcastToRoom(
        suggestion.tripId,
        {
          type: 'suggestion:updated',
          suggestionId: suggestion.id,
          suggestion,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.send(suggestion);
    })
  );

  /**
   * Delete a suggestion
   * DELETE /api/v1/suggestions/:id
   */
  fastify.delete(
    '/suggestions/:id',
    {
      schema: { tags: ['suggestions'], params: suggestionIdSchema },
      preHandler: [authenticate, validateParams(suggestionIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      // Get suggestion before deleting to get tripId for broadcast
      const suggestion = await suggestionService.getSuggestion(
        request.params.id,
        request.user.userId
      );
      const tripId = suggestion.tripId;
      const suggestionId = suggestion.id;

      await suggestionService.deleteSuggestion(
        request.params.id,
        request.user.userId
      );

      // Broadcast deletion to all users in the trip room
      broadcastToRoom(
        tripId,
        {
          type: 'suggestion:deleted',
          suggestionId,
          userId: request.user.userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.code(204).send();
    })
  );

  /**
   * Get suggestion statistics for a trip
   * GET /api/v1/trips/:tripId/suggestions/stats
   */
  fastify.get(
    '/trips/:tripId/suggestions/stats',
    {
      schema: { tags: ['suggestions'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const stats = await suggestionService.getSuggestionStats(
        request.params.tripId,
        request.user.userId
      );
      reply.send(stats);
    })
  );
}
