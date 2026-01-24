
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createMockActivity } from '../../helpers.js';

// Mock pg module at the top
vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Reservations Routes', () => {
  let app;
  let tripQueries;
  let tripBuddyService;
  let activityQueries;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/db/queries/activities.js', () => ({
      findByTripId: vi.fn(),
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateParams: vi.fn(() => (req, reply, done) => done()),
      validateQuery: vi.fn(() => (req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
      NotFoundError: class NotFoundError extends Error {
        constructor(message) { super(message); this.statusCode = 404; }
      },
    }));

    vi.doMock('../../../src/services/trip-buddy-service.js', () => ({
      checkAccess: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const reservationsRoutes = (await import('../../../src/routes/reservations.js')).default;
    tripQueries = await import('../../../src/db/queries/trips.js');
    tripBuddyService = await import('../../../src/services/trip-buddy-service.js');
    activityQueries = await import('../../../src/db/queries/activities.js');

    app = Fastify();
    app.register(reservationsRoutes);
  });

  describe('GET /trips/:tripId/reservations', () => {
    it('should return a list of reservations for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockActivities = [
        createMockActivity({
          type: 'hotel',
          metadata: { isReservation: true, confirmationCode: 'ABC', reservationType: 'hotel' },
          start_time: new Date('2025-01-01T14:00:00.000Z'),
          end_time: new Date('2025-01-05T11:00:00.000Z'),
        }),
        createMockActivity({ type: 'attraction', metadata: {} }), // Not a reservation
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      activityQueries.findByTripId.mockResolvedValue(mockActivities);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/reservations',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      expect(payload.total).toBe(1);
      expect(payload.reservations[0].type).toBe('hotel');
      expect(payload.reservations[0].confirmationCode).toBe('ABC');
      expect(payload.grouped.hotel.length).toBe(1);
    });

    it('should filter reservations by type', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockActivities = [
        createMockActivity({
          id: 'res-1', type: 'accommodation',
          metadata: { isReservation: true, reservationType: 'hotel' },
        }),
        createMockActivity({
          id: 'res-2', type: 'flight',
          metadata: { isReservation: true, reservationType: 'flight' },
        }),
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      activityQueries.findByTripId.mockResolvedValue(mockActivities);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/reservations?type=accommodation',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.total).toBe(1);
      expect(payload.reservations[0].type).toBe('accommodation');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/reservations',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/reservations',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });
  });
});
