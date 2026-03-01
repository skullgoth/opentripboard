// T196: Reservation routes - list reservations
import * as activityQueries from '../db/queries/activities.js';
import { authenticate } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validation.js';
import { asyncHandler, NotFoundError } from '../middleware/error-handler.js';
import { checkAccess } from '../services/trip-buddy-service.js';
import * as tripQueries from '../db/queries/trips.js';

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

// All valid reservation types for filtering
const FILTER_TYPES = [
  // Lodging
  'hotel', 'rental',
  // Transport
  'bus', 'car', 'cruise', 'ferry', 'flight', 'train',
  // Dining
  'bar', 'restaurant',
  // Legacy types
  'accommodation', 'transportation', 'event', 'other',
  // Special filter
  'all',
];

const filterSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: FILTER_TYPES,
    },
  },
};

export default async function reservationRoutes(fastify) {
  /**
   * Get all reservations for a trip
   * GET /trips/:tripId/reservations
   */
  fastify.get(
    '/trips/:tripId/reservations',
    {
      schema: { tags: ['reservations'], params: tripIdSchema, querystring: filterSchema },
      preHandler: [authenticate, validateParams(tripIdSchema), validateQuery(filterSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const { type } = request.query;
      const userId = request.user.userId;

      // Verify trip exists and user has access
      const trip = await tripQueries.findById(tripId);
      if (!trip) {
        throw new NotFoundError('Trip');
      }

      const hasAccess = await checkAccess(tripId, userId);
      if (!hasAccess) {
        throw new NotFoundError('Trip');
      }

      // Get all activities for the trip
      const activities = await activityQueries.findByTripId(tripId);

      // Filter to only those with reservation metadata
      let reservations = activities
        .filter(activity => activity.metadata && activity.metadata.isReservation)
        .map(formatReservation);

      // Filter by type if specified
      if (type && type !== 'all') {
        reservations = reservations.filter(r => r.type === type);
      }

      // Group by type for easier frontend consumption
      const grouped = {
        // Lodging
        hotel: reservations.filter(r => r.type === 'hotel'),
        rental: reservations.filter(r => r.type === 'rental'),
        // Transport
        bus: reservations.filter(r => r.type === 'bus'),
        car: reservations.filter(r => r.type === 'car'),
        cruise: reservations.filter(r => r.type === 'cruise'),
        ferry: reservations.filter(r => r.type === 'ferry'),
        flight: reservations.filter(r => r.type === 'flight'),
        train: reservations.filter(r => r.type === 'train'),
        // Dining
        bar: reservations.filter(r => r.type === 'bar'),
        restaurant: reservations.filter(r => r.type === 'restaurant'),
        // Legacy types (for backward compatibility)
        accommodation: reservations.filter(r => r.type === 'accommodation'),
        transportation: reservations.filter(r => r.type === 'transportation'),
        event: reservations.filter(r => r.type === 'event'),
        other: reservations.filter(r => r.type === 'other'),
      };

      reply.send({
        reservations,
        grouped,
        total: reservations.length,
      });
    })
  );
}

/**
 * Format activity as reservation for API response
 */
function formatReservation(activity) {
  const metadata = activity.metadata || {};

  return {
    id: activity.id,
    tripId: activity.trip_id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    location: activity.location,
    latitude: activity.latitude ? parseFloat(activity.latitude) : null,
    longitude: activity.longitude ? parseFloat(activity.longitude) : null,
    startTime: activity.start_time,
    endTime: activity.end_time,
    confirmationCode: metadata.confirmationCode,
    provider: metadata.provider,
    reservationType: metadata.reservationType,
    metadata,
    createdAt: activity.created_at,
    updatedAt: activity.updated_at,
  };
}
