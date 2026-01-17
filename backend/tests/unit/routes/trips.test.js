
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createMockTrip } from '../../helpers.js';

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

describe('Trips Routes', () => {
  let app;
  let tripService;
  let activityService;
  let routeOptimizer;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/services/trip-service.js', () => ({
      create: vi.fn(),
      listByUser: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      deleteTrip: vi.fn(),
      getStatistics: vi.fn(),
    }));

    vi.doMock('../../../src/services/activity-service.js', () => ({
      listByTrip: vi.fn(),
    }));

    vi.doMock('../../../src/services/route-optimizer.js', () => ({
      optimizeRoute: vi.fn(),
      calculateDistanceBetween: vi.fn(),
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
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(500).send({ error: err.message });
        }
      },
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const tripsRouter = (await import('../../../src/routes/trips.js')).default;
    tripService = await import('../../../src/services/trip-service.js');
    activityService = await import('../../../src/services/activity-service.js');
    routeOptimizer = await import('../../../src/services/route-optimizer.js');


    app = Fastify();
    app.register(tripsRouter);
  });

  describe('GET /trips', () => {
    it('should return a list of trips for the user', async () => {
      const mockTrips = [createMockTrip()];
      tripService.listByUser.mockResolvedValue(mockTrips);

      const response = await app.inject({ method: 'GET', url: '/trips' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(JSON.parse(JSON.stringify(mockTrips)));
    });
  });

  describe('GET /trips/:id', () => {
    it('should return a single trip if found', async () => {
      const mockTrip = createMockTrip();
      tripService.get.mockResolvedValue(mockTrip);

      const response = await app.inject({ method: 'GET', url: '/trips/trip-123' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(JSON.parse(JSON.stringify(mockTrip)));
    });
  });

  describe('POST /trips', () => {
    it('should create a new trip', async () => {
      const newTripData = { name: 'Test Trip' };
      tripService.create.mockResolvedValue({ id: 'trip-new', ...newTripData });

      const response = await app.inject({
        method: 'POST',
        url: '/trips',
        payload: newTripData,
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('PATCH /trips/:id', () => {
    it('should update a trip', async () => {
      const updates = { name: 'Updated Trip' };
      tripService.update.mockResolvedValue({ id: 'trip-123', ...updates });

      const response = await app.inject({
        method: 'PATCH',
        url: '/trips/trip-123',
        payload: updates,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /trips/:id', () => {
    it('should delete a trip', async () => {
      tripService.deleteTrip.mockResolvedValue({ success: true });

      const response = await app.inject({
        method: 'DELETE',
        url: '/trips/trip-123',
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('GET /trips/:id/stats', () => {
    it('should return statistics for a trip', async () => {
      const mockStats = {
        activityCount: 10,
        documentCount: 5,
        expenseCount: 20,
        totalSpent: 1500,
      };
      tripService.getStatistics.mockResolvedValue(mockStats);

      const response = await app.inject({ method: 'GET', url: '/trips/trip-123/stats' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockStats);
    });
  });

  describe('POST /trips/:id/optimize-route', () => {
    it('should return an optimized route', async () => {
      const mockActivities = [{ id: 'act-1' }, { id: 'act-2' }];
      const mockOptimization = { message: 'Route optimized', activities: mockActivities };
      activityService.listByTrip.mockResolvedValue(mockActivities);
      routeOptimizer.optimizeRoute.mockReturnValue(mockOptimization);

      const response = await app.inject({ method: 'POST', url: '/trips/trip-123/optimize-route' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toBe('Route optimized');
    });
  });

  describe('POST /trips/:id/calculate-distance', () => {
    it('should return the distance between two activities', async () => {
      const mockActivities = [
        { id: 'act-1', latitude: 1, longitude: 1 },
        { id: 'act-2', latitude: 2, longitude: 2 },
      ];
      const mockDistanceResult = { distance: 100, unit: 'km' };

      activityService.listByTrip.mockResolvedValue(mockActivities);
      routeOptimizer.calculateDistanceBetween.mockReturnValue(mockDistanceResult);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/calculate-distance',
        payload: { activityId1: 'act-1', activityId2: 'act-2' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockDistanceResult);
    });

    it('should return 400 if activityId1 is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/calculate-distance',
        payload: { activityId2: 'act-2' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Both activityId1 and activityId2 are required');
    });

    it('should return 400 if activityId2 is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/calculate-distance',
        payload: { activityId1: 'act-1' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Both activityId1 and activityId2 are required');
    });

    it('should return 404 if one or both activities not found', async () => {
      activityService.listByTrip.mockResolvedValue([{ id: 'act-1', latitude: 1, longitude: 1 }]);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/calculate-distance',
        payload: { activityId1: 'act-1', activityId2: 'act-3' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('One or both activities not found');
    });
  });
});
