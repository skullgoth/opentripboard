// T068: Trip routes - CRUD operations
// T092 & T093: Cover image upload and delete endpoints
// T177: Route optimization endpoint
import * as tripService from '../services/trip-service.js';
import * as activityService from '../services/activity-service.js';
import * as routeOptimizer from '../services/route-optimizer.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';
import { saveUploadedFile, deleteUploadedFile } from '../middleware/upload.js';
import * as imageService from '../services/image-service.js';
import path from 'path';

const createTripSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    destination: {
      type: 'string',
      maxLength: 255,
    },
    startDate: {
      type: 'string',
      format: 'date',
    },
    endDate: {
      type: 'string',
      format: 'date',
    },
    budget: {
      type: ['number', 'null'],
      minimum: 0,
    },
    currency: {
      type: 'string',
      maxLength: 3,
    },
    timezone: {
      type: 'string',
      maxLength: 50,
    },
    description: {
      type: ['string', 'null'],
    },
    // T014: New fields for destination autocomplete feature
    destinationData: {
      type: ['object', 'null'],
      properties: {
        place_id: { type: 'number' },
        display_name: { type: 'string' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        type: { type: 'string' },
        address: { type: 'object' },
        validated: { type: 'boolean' },
      },
    },
    coverImageAttribution: {
      type: ['object', 'null'],
      properties: {
        source: { type: 'string', enum: ['pexels', 'user_upload', 'placeholder'] },
        photographer: { type: 'string' },
        photographer_url: { type: 'string' },
        photo_id: { type: 'number' },
        photo_url: { type: 'string' },
      },
    },
  },
  additionalProperties: false,
};

const updateTripSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    destination: {
      type: 'string',
      maxLength: 255,
    },
    startDate: {
      type: 'string',
      format: 'date',
    },
    endDate: {
      type: 'string',
      format: 'date',
    },
    budget: {
      type: ['number', 'null'],
      minimum: 0,
    },
    currency: {
      type: 'string',
      maxLength: 3,
    },
    timezone: {
      type: 'string',
      maxLength: 50,
    },
    description: {
      type: ['string', 'null'],
    },
    // T014: New fields for destination autocomplete feature
    destinationData: {
      type: ['object', 'null'],
      properties: {
        place_id: { type: 'number' },
        display_name: { type: 'string' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        type: { type: 'string' },
        address: { type: 'object' },
        validated: { type: 'boolean' },
      },
    },
    coverImageAttribution: {
      type: ['object', 'null'],
      properties: {
        source: { type: 'string', enum: ['pexels', 'user_upload', 'placeholder'] },
        photographer: { type: 'string' },
        photographer_url: { type: 'string' },
        photo_id: { type: 'number' },
        photo_url: { type: 'string' },
      },
    },
  },
  additionalProperties: false,
};

const tripIdSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
  },
};

export default async function tripRoutes(fastify) {
  /**
   * Create a new trip
   */
  fastify.post(
    '/trips',
    {
      schema: { tags: ['trips'], body: createTripSchema },
      preHandler: [authenticate, validateBody(createTripSchema)],
    },
    asyncHandler(async (request, reply) => {
      const trip = await tripService.create(request.user.userId, request.body);
      reply.code(201).send(trip);
    })
  );

  /**
   * Get all trips for current user
   */
  fastify.get(
    '/trips',
    {
      schema: { tags: ['trips'] },
      preHandler: authenticate,
    },
    asyncHandler(async (request, reply) => {
      const trips = await tripService.listByUser(request.user.userId);
      reply.send(trips);
    })
  );

  /**
   * Get trip by ID
   */
  fastify.get(
    '/trips/:id',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const trip = await tripService.get(request.params.id, request.user.userId);
      reply.send(trip);
    })
  );

  /**
   * Update trip
   */
  fastify.patch(
    '/trips/:id',
    {
      schema: { tags: ['trips'], params: tripIdSchema, body: updateTripSchema },
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(updateTripSchema)],
    },
    asyncHandler(async (request, reply) => {
      const trip = await tripService.update(
        request.params.id,
        request.user.userId,
        request.body
      );
      reply.send(trip);
    })
  );

  /**
   * Delete trip
   */
  fastify.delete(
    '/trips/:id',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      await tripService.deleteTrip(request.params.id, request.user.userId);
      reply.code(204).send();
    })
  );

  /**
   * Get trip statistics
   */
  fastify.get(
    '/trips/:id/stats',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const stats = await tripService.getStatistics(request.params.id, request.user.userId);
      reply.send(stats);
    })
  );

  /**
   * T092: Upload cover image for trip
   */
  fastify.post(
    '/trips/:id/cover-image',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      // Get multipart file data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Save uploaded file to disk
      const uploadDir = process.env.UPLOAD_DIR || './uploads/cover-images';
      const fileInfo = await saveUploadedFile(data, uploadDir);

      // Process image (resize, optimize)
      const processedPath = path.join(
        uploadDir,
        `processed-${fileInfo.filename}`
      );

      await imageService.processCoverImage(
        fileInfo.filepath,
        processedPath,
        {
          format: 'jpeg',
          quality: 85,
        }
      );

      // Delete original unprocessed file
      await deleteUploadedFile(fileInfo.filepath);

      // Generate relative URL path for storage
      const imageUrl = `/uploads/cover-images/processed-${fileInfo.filename}`;

      // Update trip with cover image URL
      const trip = await tripService.updateCoverImage(
        request.params.id,
        request.user.userId,
        imageUrl
      );

      reply.send({
        message: 'Cover image uploaded successfully',
        coverImageUrl: imageUrl,
        trip,
      });
    })
  );

  /**
   * T093: Delete cover image for trip
   */
  fastify.delete(
    '/trips/:id/cover-image',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      // Get current trip to find cover image path
      const trip = await tripService.get(request.params.id, request.user.userId);

      if (trip.coverImageUrl) {
        // Convert URL to filesystem path
        const uploadDir = process.env.UPLOAD_DIR || './uploads/cover-images';
        const filename = path.basename(trip.coverImageUrl);
        const filepath = path.join(uploadDir, filename);

        // Delete file from filesystem
        await imageService.deleteImage(filepath);
      }

      // Update trip to remove cover image URL
      const updatedTrip = await tripService.updateCoverImage(
        request.params.id,
        request.user.userId,
        null
      );

      reply.send({ trip: updatedTrip });
    })
  );

  /**
   * T177: Optimize route for trip activities
   * POST /trips/:id/optimize-route
   */
  fastify.post(
    '/trips/:id/optimize-route',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      // Verify user has access to this trip
      await tripService.get(request.params.id, request.user.userId);

      // Get all activities for the trip
      const activities = await activityService.listByTrip(
        request.params.id,
        request.user.userId
      );

      // Optimize route
      const optimization = routeOptimizer.optimizeRoute(activities, {
        startPoint: 'first' // Start from the first activity
      });

      reply.send({
        message: optimization.message,
        totalDistance: optimization.totalDistance,
        totalTravelTime: optimization.totalTravelTime,
        optimizedActivities: optimization.activities.map((activity, index) => ({
          id: activity.id,
          title: activity.title,
          sortOrder: index,
          latitude: activity.latitude,
          longitude: activity.longitude
        }))
      });
    })
  );

  /**
   * Calculate distance between two activities
   * POST /trips/:id/calculate-distance
   */
  fastify.post(
    '/trips/:id/calculate-distance',
    {
      schema: { tags: ['trips'], params: tripIdSchema },
      preHandler: [authenticate, validateParams(tripIdSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { activityId1, activityId2 } = request.body;

      if (!activityId1 || !activityId2) {
        return reply.code(400).send({
          error: 'Both activityId1 and activityId2 are required'
        });
      }

      // Verify user has access to this trip
      await tripService.get(request.params.id, request.user.userId);

      // Get activities
      const activities = await activityService.listByTrip(
        request.params.id,
        request.user.userId
      );

      const activity1 = activities.find(a => a.id === activityId1);
      const activity2 = activities.find(a => a.id === activityId2);

      if (!activity1 || !activity2) {
        return reply.code(404).send({
          error: 'One or both activities not found'
        });
      }

      const result = routeOptimizer.calculateDistanceBetween(activity1, activity2);

      reply.send(result);
    })
  );
}
