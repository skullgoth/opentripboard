// T229: Document routes - Upload, manage, and download documents
import * as documentQueries from '../db/queries/documents.js';
import * as tripQueries from '../db/queries/trips.js';
import * as tripBuddyQueries from '../db/queries/trip-buddies.js';
import * as activityQueries from '../db/queries/activities.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../middleware/error-handler.js';
import { saveDocumentFile, deleteDocumentFile } from '../middleware/document-upload.js';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || './uploads/documents';

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

const documentIdSchema = {
  type: 'object',
  required: ['tripId', 'documentId'],
  properties: {
    tripId: {
      type: 'string',
      format: 'uuid',
    },
    documentId: {
      type: 'string',
      format: 'uuid',
    },
  },
};

const updateDocumentSchema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['passport', 'visa', 'ticket', 'reservation', 'insurance', 'itinerary', 'photo', 'other'],
    },
    description: {
      type: ['string', 'null'],
      maxLength: 1000,
    },
    activityId: {
      oneOf: [
        { type: 'string', format: 'uuid' },
        { type: 'string', maxLength: 0 },
        { type: 'null' },
      ],
    },
  },
};

/**
 * Check if user has access to trip
 */
async function checkTripAccess(tripId, userId) {
  const trip = await tripQueries.findById(tripId);
  if (!trip) {
    throw new NotFoundError('Trip');
  }

  const isOwner = trip.owner_id === userId;
  const tripBuddy = await tripBuddyQueries.findByTripAndUser(tripId, userId);
  const isCollaborator = tripBuddy && tripBuddy.accepted_at;

  if (!isOwner && !isCollaborator) {
    throw new AuthorizationError('You do not have access to this trip');
  }

  return trip;
}

export default async function documentRoutes(fastify) {
  /**
   * Get all documents for a trip
   * GET /api/v1/trips/:tripId/documents
   */
  fastify.get(
    '/trips/:tripId/documents',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const { category, activityId } = request.query;
      const documents = await documentQueries.findByTripId(request.params.tripId, {
        category,
        activityId,
      });

      reply.send(documents);
    })
  );

  /**
   * Get document category counts for a trip
   * GET /api/v1/trips/:tripId/documents/stats
   */
  fastify.get(
    '/trips/:tripId/documents/stats',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const [categoryCounts, storageUsage] = await Promise.all([
        documentQueries.getCategoryCounts(request.params.tripId),
        documentQueries.getTripStorageUsage(request.params.tripId),
      ]);

      reply.send({
        categoryCounts,
        storageUsage,
        totalDocuments: Object.values(categoryCounts).reduce((a, b) => a + b, 0),
      });
    })
  );

  /**
   * Upload a document
   * POST /api/v1/trips/:tripId/documents
   */
  fastify.post(
    '/trips/:tripId/documents',
    {
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      // Get multipart data
      const data = await request.file();
      if (!data) {
        throw new ValidationError('No file provided');
      }

      // Get form fields from multipart data
      // Note: Text fields must come BEFORE the file in the FormData for proper parsing
      const fields = {};
      if (data.fields) {
        for (const [key, field] of Object.entries(data.fields)) {
          if (field !== undefined && typeof field === 'object' && field !== null && 'value' in field) {
            fields[key] = field.value;
          }
        }
      }

      // If activityId is provided, verify it exists and belongs to this trip
      if (fields.activityId) {
        const activity = await activityQueries.findById(fields.activityId);
        if (!activity || activity.trip_id !== request.params.tripId) {
          throw new ValidationError('Invalid activity ID');
        }
      }

      // Save file
      const fileInfo = await saveDocumentFile(data, UPLOAD_DIR);

      // Create document record
      const document = await documentQueries.create({
        tripId: request.params.tripId,
        activityId: fields.activityId || null,
        uploadedBy: request.user.userId,
        fileName: fileInfo.originalFilename,
        fileSize: fileInfo.size,
        fileType: fileInfo.mimetype,
        filePath: fileInfo.filepath,
        category: fields.category || 'other',
        description: fields.description || null,
      });

      reply.code(201).send(document);
    })
  );

  /**
   * Get a specific document
   * GET /api/v1/trips/:tripId/documents/:documentId
   */
  fastify.get(
    '/trips/:tripId/documents/:documentId',
    {
      preHandler: [authenticate, validateParams(documentIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const document = await documentQueries.findById(request.params.documentId);
      if (!document || document.tripId !== request.params.tripId) {
        throw new NotFoundError('Document');
      }

      reply.send(document);
    })
  );

  /**
   * Download a document
   * GET /api/v1/trips/:tripId/documents/:documentId/download
   */
  fastify.get(
    '/trips/:tripId/documents/:documentId/download',
    {
      preHandler: [authenticate, validateParams(documentIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const document = await documentQueries.findById(request.params.documentId);
      if (!document || document.tripId !== request.params.tripId) {
        throw new NotFoundError('Document');
      }

      // Check if file exists
      try {
        await fs.access(document.filePath);
      } catch {
        throw new NotFoundError('File not found on disk');
      }

      // Send file
      const stream = await fs.open(document.filePath);
      reply.header('Content-Type', document.fileType);
      reply.header('Content-Disposition', `attachment; filename="${document.fileName}"`);
      reply.header('Content-Length', document.fileSize);

      return reply.send(stream.createReadStream());
    })
  );

  /**
   * Update a document
   * PATCH /api/v1/trips/:tripId/documents/:documentId
   */
  fastify.patch(
    '/trips/:tripId/documents/:documentId',
    {
      preHandler: [authenticate, validateParams(documentIdSchema), validateBody(updateDocumentSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const document = await documentQueries.findById(request.params.documentId);
      if (!document || document.tripId !== request.params.tripId) {
        throw new NotFoundError('Document');
      }

      // If activityId is being changed, verify new activity exists and belongs to this trip
      if (request.body.activityId !== undefined && request.body.activityId !== null) {
        const activity = await activityQueries.findById(request.body.activityId);
        if (!activity || activity.trip_id !== request.params.tripId) {
          throw new ValidationError('Invalid activity ID');
        }
      }

      const updatedDocument = await documentQueries.update(request.params.documentId, request.body);
      reply.send(updatedDocument);
    })
  );

  /**
   * Delete a document
   * DELETE /api/v1/trips/:tripId/documents/:documentId
   */
  fastify.delete(
    '/trips/:tripId/documents/:documentId',
    {
      preHandler: [authenticate, validateParams(documentIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const document = await documentQueries.findById(request.params.documentId);
      if (!document || document.tripId !== request.params.tripId) {
        throw new NotFoundError('Document');
      }

      // Delete from database first
      const deleted = await documentQueries.deleteDocument(request.params.documentId);

      // Then delete file from disk
      if (deleted && deleted.filePath) {
        try {
          await deleteDocumentFile(deleted.filePath);
        } catch (err) {
          // Log but don't fail the request - file might already be gone
          console.warn(`Failed to delete file ${deleted.filePath}:`, err.message);
        }
      }

      reply.code(204).send();
    })
  );

  /**
   * Get documents for a specific activity
   * GET /api/v1/trips/:tripId/activities/:activityId/documents
   */
  fastify.get(
    '/trips/:tripId/activities/:activityId/documents',
    {
      preHandler: [authenticate],
    },
    asyncHandler(async (request, reply) => {
      await checkTripAccess(request.params.tripId, request.user.userId);

      const activity = await activityQueries.findById(request.params.activityId);
      if (!activity || activity.trip_id !== request.params.tripId) {
        throw new NotFoundError('Activity');
      }

      const documents = await documentQueries.findByActivityId(request.params.activityId);
      reply.send(documents);
    })
  );
}
