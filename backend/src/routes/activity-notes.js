// Activity notes routes - CRUD endpoints for notes on activities
import * as activityNotesService from '../services/activity-notes-service.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { broadcastToRoom } from '../websocket/rooms.js';

const activityParamsSchema = {
  type: 'object',
  required: ['tripId', 'activityId'],
  properties: {
    tripId: { type: 'string', format: 'uuid' },
    activityId: { type: 'string', format: 'uuid' },
  },
};

const noteParamsSchema = {
  type: 'object',
  required: ['tripId', 'activityId', 'noteId'],
  properties: {
    tripId: { type: 'string', format: 'uuid' },
    activityId: { type: 'string', format: 'uuid' },
    noteId: { type: 'string', format: 'uuid' },
  },
};

const createNoteSchema = {
  type: 'object',
  required: ['content'],
  properties: {
    content: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  additionalProperties: false,
};

const updateNoteSchema = {
  type: 'object',
  required: ['content'],
  properties: {
    content: { type: 'string', minLength: 1, maxLength: 2000 },
  },
  additionalProperties: false,
};

export default async function activityNotesRoutes(fastify) {
  /**
   * Create a note on an activity
   * POST /trips/:tripId/activities/:activityId/notes
   */
  fastify.post(
    '/trips/:tripId/activities/:activityId/notes',
    {
      schema: { tags: ['activity-notes'], params: activityParamsSchema, body: createNoteSchema },
      preHandler: [authenticate, validateParams(activityParamsSchema), validateBody(createNoteSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId, activityId } = request.params;
      const { content } = request.body;

      const note = await activityNotesService.create(tripId, activityId, request.user.userId, content);

      broadcastToRoom(tripId, {
        type: 'activity:note-added',
        tripId,
        activityId,
        note,
        userId: request.user.userId,
        timestamp: new Date().toISOString(),
      });

      reply.code(201).send(note);
    })
  );

  /**
   * List notes for an activity
   * GET /trips/:tripId/activities/:activityId/notes
   */
  fastify.get(
    '/trips/:tripId/activities/:activityId/notes',
    {
      schema: { tags: ['activity-notes'], params: activityParamsSchema },
      preHandler: [authenticate, validateParams(activityParamsSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId, activityId } = request.params;

      const notes = await activityNotesService.listByActivity(tripId, activityId, request.user.userId);
      reply.send(notes);
    })
  );

  /**
   * Update a note
   * PATCH /trips/:tripId/activities/:activityId/notes/:noteId
   */
  fastify.patch(
    '/trips/:tripId/activities/:activityId/notes/:noteId',
    {
      schema: { tags: ['activity-notes'], params: noteParamsSchema, body: updateNoteSchema },
      preHandler: [authenticate, validateParams(noteParamsSchema), validateBody(updateNoteSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId, activityId, noteId } = request.params;
      const { content } = request.body;

      const note = await activityNotesService.update(noteId, request.user.userId, content);

      broadcastToRoom(tripId, {
        type: 'activity:note-updated',
        tripId,
        activityId,
        noteId,
        note,
        userId: request.user.userId,
        timestamp: new Date().toISOString(),
      });

      reply.send(note);
    })
  );

  /**
   * Delete a note
   * DELETE /trips/:tripId/activities/:activityId/notes/:noteId
   */
  fastify.delete(
    '/trips/:tripId/activities/:activityId/notes/:noteId',
    {
      schema: { tags: ['activity-notes'], params: noteParamsSchema },
      preHandler: [authenticate, validateParams(noteParamsSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId, activityId, noteId } = request.params;

      await activityNotesService.deleteNote(tripId, noteId, request.user.userId);

      broadcastToRoom(tripId, {
        type: 'activity:note-deleted',
        tripId,
        activityId,
        noteId,
        userId: request.user.userId,
        timestamp: new Date().toISOString(),
      });

      reply.code(204).send();
    })
  );
}
