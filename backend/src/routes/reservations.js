// T195-T196: Reservation routes - import from email and list reservations
import * as activityService from '../services/activity-service.js';
import * as activityQueries from '../db/queries/activities.js';
import { parseEmail, RESERVATION_TYPES } from '../services/email-parser.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler.js';
import { checkAccess } from '../services/trip-buddy-service.js';
import * as tripQueries from '../db/queries/trips.js';
import { broadcastToRoom } from '../websocket/rooms.js';

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

const importEmailSchema = {
  type: 'object',
  required: ['emailContent'],
  properties: {
    emailContent: {
      type: 'string',
      minLength: 10,
      maxLength: 500000, // 500KB max for email content
    },
  },
  additionalProperties: false,
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
   * Import a reservation from email content
   * POST /trips/:tripId/reservations/import
   */
  fastify.post(
    '/trips/:tripId/reservations/import',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(importEmailSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const { emailContent } = request.body;
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

      // Parse the email content
      const parseResult = parseEmail(emailContent);

      if (!parseResult.success) {
        throw new ValidationError(parseResult.error || 'Could not parse reservation from email');
      }

      const reservationData = parseResult.data;

      // Map reservation type to activity type
      const activityType = mapReservationTypeToActivityType(reservationData.type);

      // Build metadata with reservation details
      const metadata = {
        isReservation: true,
        confirmationCode: reservationData.confirmationCode,
        provider: reservationData.provider,
        reservationType: reservationData.type,
        ...buildTypeSpecificMetadata(reservationData),
      };

      // Determine dates based on reservation type
      let startTime = null;
      let endTime = null;

      if (reservationData.type === RESERVATION_TYPES.FLIGHT) {
        startTime = buildDateTime(reservationData.departureDate, reservationData.departureTime);
      } else if (reservationData.type === RESERVATION_TYPES.HOTEL) {
        startTime = reservationData.checkInDate ? `${reservationData.checkInDate}T14:00:00.000Z` : null;
        endTime = reservationData.checkOutDate ? `${reservationData.checkOutDate}T11:00:00.000Z` : null;
      } else if (reservationData.type === RESERVATION_TYPES.CAR) {
        startTime = reservationData.pickupDate ? `${reservationData.pickupDate}T10:00:00.000Z` : null;
        endTime = reservationData.dropoffDate ? `${reservationData.dropoffDate}T10:00:00.000Z` : null;
      } else if (reservationData.type === RESERVATION_TYPES.RESTAURANT) {
        startTime = buildDateTime(reservationData.reservationDate, reservationData.reservationTime);
      }

      // Create the activity with reservation data
      const activityData = {
        type: activityType,
        title: reservationData.title || `${reservationData.provider} Reservation`,
        description: buildDescription(reservationData),
        location: reservationData.location || null,
        startTime,
        endTime,
        metadata,
      };

      const activity = await activityService.create(tripId, userId, activityData);

      // Broadcast activity creation via WebSocket
      broadcastToRoom(
        tripId,
        {
          type: 'activity:created',
          activity,
          userId,
          timestamp: new Date().toISOString(),
        }
      );

      reply.code(201).send({
        success: true,
        message: 'Reservation imported successfully',
        activity,
        parsed: {
          type: reservationData.type,
          provider: reservationData.provider,
          confirmationCode: reservationData.confirmationCode,
        },
      });
    })
  );

  /**
   * Preview parsed reservation from email (without creating)
   * POST /trips/:tripId/reservations/preview
   */
  fastify.post(
    '/trips/:tripId/reservations/preview',
    {
      preHandler: [authenticate, validateParams(tripIdSchema), validateBody(importEmailSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { tripId } = request.params;
      const { emailContent } = request.body;
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

      // Parse the email content
      const parseResult = parseEmail(emailContent);

      if (!parseResult.success) {
        reply.send({
          success: false,
          error: parseResult.error || 'Could not parse reservation from email',
          data: null,
        });
        return;
      }

      const reservationData = parseResult.data;
      const activityType = mapReservationTypeToActivityType(reservationData.type);

      // Build preview data
      const preview = {
        type: activityType,
        title: reservationData.title || `${reservationData.provider} Reservation`,
        description: buildDescription(reservationData),
        location: reservationData.location || null,
        reservationType: reservationData.type,
        provider: reservationData.provider,
        confirmationCode: reservationData.confirmationCode,
        ...getDatePreview(reservationData),
      };

      reply.send({
        success: true,
        data: preview,
        raw: reservationData,
      });
    })
  );

  /**
   * Get all reservations for a trip
   * GET /trips/:tripId/reservations
   */
  fastify.get(
    '/trips/:tripId/reservations',
    {
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
 * Map reservation type to activity type
 */
function mapReservationTypeToActivityType(reservationType) {
  const mapping = {
    [RESERVATION_TYPES.FLIGHT]: 'flight',
    [RESERVATION_TYPES.HOTEL]: 'accommodation',
    [RESERVATION_TYPES.CAR]: 'transportation',
    [RESERVATION_TYPES.RESTAURANT]: 'restaurant',
    [RESERVATION_TYPES.EVENT]: 'event',
    [RESERVATION_TYPES.OTHER]: 'other',
  };
  return mapping[reservationType] || 'other';
}

/**
 * Build type-specific metadata fields
 */
function buildTypeSpecificMetadata(data) {
  const metadata = {};

  switch (data.type) {
    case RESERVATION_TYPES.FLIGHT:
      if (data.flightNumbers) metadata.flightNumbers = data.flightNumbers;
      if (data.origin) metadata.origin = data.origin;
      if (data.destination) metadata.destination = data.destination;
      if (data.departureTime) metadata.departureTime = data.departureTime;
      break;

    case RESERVATION_TYPES.HOTEL:
      if (data.hotelName) metadata.hotelName = data.hotelName;
      if (data.checkInDate) metadata.checkInDate = data.checkInDate;
      if (data.checkOutDate) metadata.checkOutDate = data.checkOutDate;
      if (data.address) metadata.address = data.address;
      break;

    case RESERVATION_TYPES.CAR:
      if (data.pickupDate) metadata.pickupDate = data.pickupDate;
      if (data.dropoffDate) metadata.dropoffDate = data.dropoffDate;
      if (data.pickupLocation) metadata.pickupLocation = data.pickupLocation;
      if (data.vehicleType) metadata.vehicleType = data.vehicleType;
      break;

    case RESERVATION_TYPES.RESTAURANT:
      if (data.restaurantName) metadata.restaurantName = data.restaurantName;
      if (data.reservationDate) metadata.reservationDate = data.reservationDate;
      if (data.reservationTime) metadata.reservationTime = data.reservationTime;
      if (data.partySize) metadata.partySize = data.partySize;
      break;
  }

  return metadata;
}

/**
 * Build description from reservation data
 */
function buildDescription(data) {
  const parts = [];

  if (data.confirmationCode) {
    parts.push(`Confirmation: ${data.confirmationCode}`);
  }

  if (data.provider) {
    parts.push(`Provider: ${data.provider}`);
  }

  switch (data.type) {
    case RESERVATION_TYPES.FLIGHT:
      if (data.flightNumbers && data.flightNumbers.length > 0) {
        parts.push(`Flight: ${data.flightNumbers.join(', ')}`);
      }
      if (data.origin && data.destination) {
        parts.push(`Route: ${data.origin} → ${data.destination}`);
      }
      break;

    case RESERVATION_TYPES.HOTEL:
      if (data.checkInDate && data.checkOutDate) {
        parts.push(`Check-in: ${data.checkInDate}, Check-out: ${data.checkOutDate}`);
      }
      break;

    case RESERVATION_TYPES.CAR:
      if (data.vehicleType) {
        parts.push(`Vehicle: ${data.vehicleType}`);
      }
      if (data.pickupLocation) {
        parts.push(`Pickup: ${data.pickupLocation}`);
      }
      break;

    case RESERVATION_TYPES.RESTAURANT:
      if (data.partySize) {
        parts.push(`Party size: ${data.partySize}`);
      }
      break;
  }

  return parts.join('\n');
}

/**
 * Build ISO datetime from date and time strings
 */
function buildDateTime(dateStr, timeStr) {
  if (!dateStr) return null;

  try {
    if (timeStr) {
      // Parse time like "10:30 AM" or "14:00"
      const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        const meridiem = timeParts[3];

        if (meridiem) {
          if (meridiem.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }

        return `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`;
      }
    }

    // Default to noon if no time specified
    return `${dateStr}T12:00:00.000Z`;
  } catch {
    return `${dateStr}T12:00:00.000Z`;
  }
}

/**
 * Get date preview for different reservation types
 */
function getDatePreview(data) {
  const preview = {};

  switch (data.type) {
    case RESERVATION_TYPES.FLIGHT:
      preview.startDate = data.departureDate;
      preview.startTime = data.departureTime;
      break;

    case RESERVATION_TYPES.HOTEL:
      preview.checkInDate = data.checkInDate;
      preview.checkOutDate = data.checkOutDate;
      break;

    case RESERVATION_TYPES.CAR:
      preview.pickupDate = data.pickupDate;
      preview.dropoffDate = data.dropoffDate;
      break;

    case RESERVATION_TYPES.RESTAURANT:
      preview.reservationDate = data.reservationDate;
      preview.reservationTime = data.reservationTime;
      break;
  }

  return preview;
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
