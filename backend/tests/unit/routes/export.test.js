
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

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

describe('Export Routes', () => {
  let app;
  let tripQueries;
  let activityQueries;
  let tripBuddyQueries;
  let expenseQueries;
  let listQueries;
  let shareTokensQueries;
  let pdfGenerator;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock queries
    vi.doMock('../../../src/db/queries/trips.js', () => ({
      findById: vi.fn(),
    }));
    vi.doMock('../../../src/db/queries/activities.js', () => ({
      findByTripId: vi.fn(),
    }));
    vi.doMock('../../../src/db/queries/trip-buddies.js', () => ({
      findByTripId: vi.fn(),
      hasAccess: vi.fn(),
    }));
    vi.doMock('../../../src/db/queries/expenses.js', () => ({
      findByTripId: vi.fn(),
      getSummary: vi.fn(),
    }));
    vi.doMock('../../../src/db/queries/lists.js', () => ({
      findByTripId: vi.fn(),
    }));
    vi.doMock('../../../src/db/queries/share-tokens.js', () => ({
      createShareToken: vi.fn(),
      findByToken: vi.fn(),
      findByTripId: vi.fn(),
      deleteShareToken: vi.fn(),
      updatePermission: vi.fn(),
    }));

    // Mock services
    vi.doMock('../../../src/services/pdf-generator.js', () => ({
      generateTripPDF: vi.fn(),
    }));

    // Mock middleware
    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
        done();
      }),
    }));
    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
      validateParams: vi.fn(() => (req, reply, done) => done()),
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
      ForbiddenError: class ForbiddenError extends Error {
        constructor(message) { super(message); this.statusCode = 403; }
      },
    }));

    // Dynamically import the router and mocked dependencies
    const exportRoutes = (await import('../../../src/routes/export.js')).default;
    tripQueries = await import('../../../src/db/queries/trips.js');
    activityQueries = await import('../../../src/db/queries/activities.js');
    tripBuddyQueries = await import('../../../src/db/queries/trip-buddies.js');
    expenseQueries = await import('../../../src/db/queries/expenses.js');
    listQueries = await import('../../../src/db/queries/lists.js');
    shareTokensQueries = await import('../../../src/db/queries/share-tokens.js');
    pdfGenerator = await import('../../../src/services/pdf-generator.js');

    app = Fastify();
    app.decorate('auth', vi.fn((req, reply, done) => {
      req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
      done();
    }));
    app.register(exportRoutes);
  });

  describe('GET /trips/:tripId/export/pdf', () => {
    it('should export a trip to PDF', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123', name: 'My Trip' };
      const mockActivities = [];
      const mockTripBuddies = [];
      const mockExpenses = [];
      const mockExpenseSummary = {};
      const mockLists = [];
      const mockPdfBuffer = Buffer.from('mock pdf content');

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(true);
      activityQueries.findByTripId.mockResolvedValue(mockActivities);
      tripBuddyQueries.findByTripId.mockResolvedValue(mockTripBuddies);
      expenseQueries.findByTripId.mockResolvedValue(mockExpenses);
      expenseQueries.getSummary.mockResolvedValue(mockExpenseSummary);
      listQueries.findByTripId.mockResolvedValue(mockLists);
      pdfGenerator.generateTripPDF.mockResolvedValue(mockPdfBuffer);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/pdf',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="My_Trip_itinerary.pdf"');
      expect(response.payload).toEqual(mockPdfBuffer.toString());
      expect(pdfGenerator.generateTripPDF).toHaveBeenCalledWith(
        mockTrip,
        mockActivities,
        mockTripBuddies,
        { expenses: mockExpenses, expenseSummary: mockExpenseSummary, lists: mockLists }
      );
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/pdf',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip not found');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/pdf',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('GET /trips/:tripId/export/json', () => {
    it('should export a trip to JSON', async () => {
      const mockTrip = {
        id: 'trip-123',
        owner_id: 'user-123',
        name: 'My Trip',
        destination: 'Paris',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        cover_image_url: 'http://example.com/image.jpg',
        budget: 1000,
        currency: 'USD',
        created_at: new Date('2023-12-01'),
        updated_at: new Date('2023-12-02'),
      };
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Eiffel Tower',
          type: 'sightseeing',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T12:00:00Z',
          location: 'Eiffel Tower',
          latitude: 48.8584,
          longitude: 2.2945,
          description: 'Visit the iconic landmark',
          metadata: { notes: 'Book tickets in advance' },
          order_index: 0,
          created_at: new Date('2023-12-01'),
        },
      ];
      const mockTripBuddies = [
        {
          user_id: 'user-456',
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'editor',
          created_at: new Date('2023-12-01'),
        },
      ];
      const mockExpenses = [
        {
          id: 'expense-1',
          description: 'Hotel',
          amount: 500,
          currency: 'USD',
          category: 'accommodation',
          paid_by_name: 'John Doe',
          expense_date: '2024-01-01',
          created_at: new Date('2023-12-01'),
        },
      ];
      const mockExpenseSummary = {
        total_amount: 500,
        currency: 'USD',
        expense_count: 1,
      };
      const mockLists = [
        {
          id: 'list-1',
          title: 'Packing List',
          items: [{ text: 'Passport', completed: true }],
          created_at: new Date('2023-12-01'),
          updated_at: new Date('2023-12-02'),
        },
      ];

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(true);
      activityQueries.findByTripId.mockResolvedValue(mockActivities);
      tripBuddyQueries.findByTripId.mockResolvedValue(mockTripBuddies);
      expenseQueries.findByTripId.mockResolvedValue(mockExpenses);
      expenseQueries.getSummary.mockResolvedValue(mockExpenseSummary);
      listQueries.findByTripId.mockResolvedValue(mockLists);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toBe('attachment; filename="My_Trip_export.json"');

      const payload = JSON.parse(response.payload);
      expect(payload.trip.id).toBe('trip-123');
      expect(payload.trip.name).toBe('My Trip');
      expect(payload.trip.destination).toBe('Paris');
      expect(payload.activities).toHaveLength(1);
      expect(payload.activities[0].title).toBe('Eiffel Tower');
      expect(payload.tripBuddies).toHaveLength(1);
      expect(payload.tripBuddies[0].name).toBe('Jane Doe');
      expect(payload.expenses).toHaveLength(1);
      expect(payload.expenses[0].description).toBe('Hotel');
      expect(payload.expenseSummary.totalAmount).toBe(500);
      expect(payload.lists).toHaveLength(1);
      expect(payload.lists[0].title).toBe('Packing List');
      expect(payload.exportedAt).toBeDefined();
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/json',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip not found');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/export/json',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });

  describe('POST /trips/:tripId/share', () => {
    it('should create a share link for a trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'user-123' };
      const mockShareToken = {
        id: 'share-token-1',
        token: 'abcdef123',
        permission: 'view',
        expires_at: null,
        created_at: new Date(),
      };

      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(true);
      shareTokensQueries.createShareToken.mockResolvedValue(mockShareToken);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/share',
        payload: { expiresIn: 'never' },
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.shareToken.token).toBe('abcdef123');
      expect(payload.shareToken.shareUrl).toContain('/#/shared/abcdef123');
      expect(shareTokensQueries.createShareToken).toHaveBeenCalledWith(expect.objectContaining({
        tripId: 'trip-123',
        createdBy: 'user-123',
        permission: 'view',
        expiresAt: null,
      }));
    });

    it('should return 404 if trip not found', async () => {
      tripQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/share',
        payload: { expiresIn: 'never' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('Trip not found');
    });

    it('should return 403 if user does not have access to trip', async () => {
      const mockTrip = { id: 'trip-123', owner_id: 'other-user' };
      tripQueries.findById.mockResolvedValue(mockTrip);
      tripBuddyQueries.hasAccess.mockResolvedValue(false); // User is not owner or buddy

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/share',
        payload: { expiresIn: 'never' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).error).toBe('You do not have access to this trip');
    });
  });
});
