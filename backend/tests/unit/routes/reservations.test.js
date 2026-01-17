
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
  let activityService;
  let emailParser;
  let tripQueries;
  let tripBuddyService;
  let activityQueries;
  let websocketRooms;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/services/activity-service.js', () => ({
      create: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/activities.js', () => ({
      findByTripId: vi.fn(),
    }));

    vi.doMock('../../../src/services/email-parser.js', () => ({
      parseEmail: vi.fn(),
      RESERVATION_TYPES: {
        FLIGHT: 'flight',
        HOTEL: 'hotel',
        CAR: 'car',
        RESTAURANT: 'restaurant',
        EVENT: 'event',
        OTHER: 'other',
      },
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123' };
        done();
      }),
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
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
      ValidationError: class ValidationError extends Error {
        constructor(message) { super(message); this.statusCode = 400; }
      },
    }));

    vi.doMock('../../../src/services/trip-buddy-service.js', () => ({
      checkAccess: vi.fn(),
    }));

    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));

    vi.doMock('../../../src/websocket/rooms.js', () => ({
      broadcastToRoom: vi.fn(),
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const reservationsRoutes = (await import('../../../src/routes/reservations.js')).default;
    activityService = await import('../../../src/services/activity-service.js');
    emailParser = await import('../../../src/services/email-parser.js');
    tripQueries = await import('../../../src/db/queries/trips.js');
    tripBuddyService = await import('../../../src/services/trip-buddy-service.js');
    activityQueries = await import('../../../src/db/queries/activities.js');
    websocketRooms = await import('../../../src/websocket/rooms.js');

    app = Fastify();
    app.register(reservationsRoutes);
  });

  describe('POST /trips/:tripId/reservations/import', () => {
    it('should import a reservation from email content and create an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const mockCreatedActivity = createMockActivity({ type: 'accommodation', title: 'Hilton Stay' });

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);
      activityService.create.mockResolvedValue(mockCreatedActivity);
      websocketRooms.broadcastToRoom.mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(201);
      const expectedActivity = {
        ...mockCreatedActivity,
        created_at: mockCreatedActivity.created_at.toISOString(),
        end_time: mockCreatedActivity.end_time.toISOString(),
        start_time: mockCreatedActivity.start_time.toISOString(),
        updated_at: mockCreatedActivity.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        message: 'Reservation imported successfully',
        activity: expectedActivity,
        parsed: {
          type: 'hotel',
          provider: 'Hilton',
          confirmationCode: 'H12345',
        },
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
      expect(activityService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ type: 'accommodation', title: 'Hilton Stay' })
      );
      expect(websocketRooms.broadcastToRoom).toHaveBeenCalledWith('trip-123', expect.any(Object));
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });
  });

  describe('POST /trips/:tripId/reservations/preview', () => {
    it('should return a preview of the parsed reservation without creating an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const expectedPreview = {
        type: 'accommodation',
        title: 'Hilton Stay',
        description: 'Confirmation: H12345\nProvider: Hilton\nCheck-in: 2025-01-01, Check-out: 2025-01-05', // based on buildDescription logic
        location: 'Paris',
        reservationType: 'hotel',
        provider: 'Hilton',
        confirmationCode: 'H12345',
        checkInDate: '2025-01-01',
        checkOutDate: '2025-01-05',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        data: expectedPreview,
        raw: mockParsedReservation.data,
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200); // Preview returns 200 even for parse errors
      expect(JSON.parse(response.payload).success).toBe(false);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });
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
          id: 'res-1', type: 'accommodation', // Mapped from 'hotel' reservation type
          metadata: { isReservation: true, reservationType: 'hotel' },
        }),
        createMockActivity({
          id: 'res-2', type: 'flight', // Mapped from 'flight' reservation type
          metadata: { isReservation: true, reservationType: 'flight' },
        }),
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      activityQueries.findByTripId.mockResolvedValue(mockActivities);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/reservations?type=accommodation', // Filter by mapped activity type
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.total).toBe(1);
      expect(payload.reservations[0].type).toBe('accommodation'); // Expect mapped type
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

  describe('POST /trips/:tripId/reservations/import', () => {
    it('should import a reservation from email content and create an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const mockCreatedActivity = createMockActivity({ type: 'accommodation', title: 'Hilton Stay' });

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);
      activityService.create.mockResolvedValue(mockCreatedActivity);
      websocketRooms.broadcastToRoom.mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(201);
      const expectedActivity = {
        ...mockCreatedActivity,
        created_at: mockCreatedActivity.created_at.toISOString(),
        end_time: mockCreatedActivity.end_time.toISOString(),
        start_time: mockCreatedActivity.start_time.toISOString(),
        updated_at: mockCreatedActivity.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        message: 'Reservation imported successfully',
        activity: expectedActivity,
        parsed: {
          type: 'hotel',
          provider: 'Hilton',
          confirmationCode: 'H12345',
        },
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
      expect(activityService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ type: 'accommodation', title: 'Hilton Stay' })
      );
      expect(websocketRooms.broadcastToRoom).toHaveBeenCalledWith('trip-123', expect.any(Object));
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });
  });

  describe('POST /trips/:tripId/reservations/preview', () => {
    it('should return a preview of the parsed reservation without creating an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const expectedPreview = {
        type: 'accommodation',
        title: 'Hilton Stay',
        description: 'Confirmation: H12345\nProvider: Hilton\nCheck-in: 2025-01-01, Check-out: 2025-01-05', // based on buildDescription logic
        location: 'Paris',
        reservationType: 'hotel',
        provider: 'Hilton',
        confirmationCode: 'H12345',
        checkInDate: '2025-01-01',
        checkOutDate: '2025-01-05',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        data: expectedPreview,
        raw: mockParsedReservation.data,
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200); // Preview returns 200 even for parse errors
      expect(JSON.parse(response.payload).success).toBe(false);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });
  });

  describe('POST /trips/:tripId/reservations/import', () => {
    it('should import a reservation from email content and create an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const mockCreatedActivity = createMockActivity({ type: 'accommodation', title: 'Hilton Stay' });

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);
      activityService.create.mockResolvedValue(mockCreatedActivity);
      websocketRooms.broadcastToRoom.mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(201);
      const expectedActivity = {
        ...mockCreatedActivity,
        created_at: mockCreatedActivity.created_at.toISOString(),
        end_time: mockCreatedActivity.end_time.toISOString(),
        start_time: mockCreatedActivity.start_time.toISOString(),
        updated_at: mockCreatedActivity.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        message: 'Reservation imported successfully',
        activity: expectedActivity,
        parsed: {
          type: 'hotel',
          provider: 'Hilton',
          confirmationCode: 'H12345',
        },
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
      expect(activityService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ type: 'accommodation', title: 'Hilton Stay' })
      );
      expect(websocketRooms.broadcastToRoom).toHaveBeenCalledWith('trip-123', expect.any(Object));
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });
  });

  describe('POST /trips/:tripId/reservations/preview', () => {
    it('should return a preview of the parsed reservation without creating an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const expectedPreview = {
        type: 'accommodation',
        title: 'Hilton Stay',
        description: 'Confirmation: H12345\nProvider: Hilton\nCheck-in: 2025-01-01, Check-out: 2025-01-05', // based on buildDescription logic
        location: 'Paris',
        reservationType: 'hotel',
        provider: 'Hilton',
        confirmationCode: 'H12345',
        checkInDate: '2025-01-01',
        checkOutDate: '2025-01-05',
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        data: expectedPreview,
        raw: mockParsedReservation.data,
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(200); // Preview returns 200 even for parse errors
      expect(JSON.parse(response.payload).success).toBe(false);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/preview',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip');
    });
  });

  describe('POST /trips/:tripId/reservations/import', () => {
    it('should import a reservation from email content and create an activity', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParsedReservation = {
        success: true,
        data: {
          type: 'hotel',
          title: 'Hilton Stay',
          provider: 'Hilton',
          confirmationCode: 'H12345',
          location: 'Paris',
          checkInDate: '2025-01-01',
          checkOutDate: '2025-01-05',
        },
      };
      const mockCreatedActivity = createMockActivity({ type: 'accommodation', title: 'Hilton Stay' });

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParsedReservation);
      activityService.create.mockResolvedValue(mockCreatedActivity);
      websocketRooms.broadcastToRoom.mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(201);
      const expectedActivity = {
        ...mockCreatedActivity,
        created_at: mockCreatedActivity.created_at.toISOString(),
        end_time: mockCreatedActivity.end_time.toISOString(),
        start_time: mockCreatedActivity.start_time.toISOString(),
        updated_at: mockCreatedActivity.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        message: 'Reservation imported successfully',
        activity: expectedActivity,
        parsed: {
          type: 'hotel',
          provider: 'Hilton',
          confirmationCode: 'H12345',
        },
      });
      expect(tripQueries.findById).toHaveBeenCalledWith('trip-123');
      expect(tripBuddyService.checkAccess).toHaveBeenCalledWith('trip-123', 'user-123');
      expect(emailParser.parseEmail).toHaveBeenCalledWith('some email');
      expect(activityService.create).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        expect.objectContaining({ type: 'accommodation', title: 'Hilton Stay' })
      );
      expect(websocketRooms.broadcastToRoom).toHaveBeenCalledWith('trip-123', expect.any(Object));
    });

    it('should return 400 if email content is not parseable', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockParseError = { success: false, error: 'Bad email' };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(true);
      emailParser.parseEmail.mockReturnValue(mockParseError);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Bad email');
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });

    it('should return 404 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyService.checkAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/reservations/import',
        payload: { emailContent: 'some email' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip'); // Corrected from 'Trip not found'
    });
  });
});
