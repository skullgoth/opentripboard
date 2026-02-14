import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createMockActivity } from '../../helpers.js';

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

describe('Activities Routes', () => {
  let app;
  let activityService;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../src/services/activity-service.js', () => ({
      create: vi.fn(),
      listByTrip: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      deleteActivity: vi.fn(),
      reorder: vi.fn(),
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
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
    }));

    vi.doMock('../../../src/websocket/rooms.js', () => ({
      broadcastToRoom: vi.fn(),
    }));

    vi.doMock('../../../src/utils/default-categories.js', () => ({
      DEFAULT_ACTIVITY_TYPES: [
        { key: 'flight' },
        { key: 'train' },
        { key: 'attraction' },
        { key: 'restaurant' },
      ],
    }));

    const activityRouter = (await import('../../../src/routes/activities.js')).default;
    activityService = await import('../../../src/services/activity-service.js');

    app = Fastify();
    app.register(activityRouter);
  });

  describe('POST /trips/:tripId/activities', () => {
    it('should create a new activity', async () => {
      const mockActivity = createMockActivity();
      activityService.create.mockResolvedValue(mockActivity);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/activities',
        payload: { type: 'attraction', title: 'Visit Eiffel Tower' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).title).toBe('Visit Eiffel Tower');
    });

    it('should return 500 when service throws', async () => {
      activityService.create.mockRejectedValue(new Error('DB error'));

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/activities',
        payload: { type: 'attraction', title: 'Test' },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /trips/:tripId/activities', () => {
    it('should return activities for a trip', async () => {
      const mockActivities = [createMockActivity(), createMockActivity({ id: 'activity-456' })];
      activityService.listByTrip.mockResolvedValue(mockActivities);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/activities',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(2);
    });
  });

  describe('GET /activities/:id', () => {
    it('should return a single activity', async () => {
      const mockActivity = createMockActivity();
      activityService.get.mockResolvedValue(mockActivity);

      const response = await app.inject({
        method: 'GET',
        url: '/activities/activity-123',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).id).toBe('activity-123');
    });
  });

  describe('PATCH /activities/:id', () => {
    it('should update an activity', async () => {
      const updated = createMockActivity({ title: 'Updated Title', tripId: 'trip-123' });
      activityService.update.mockResolvedValue(updated);

      const response = await app.inject({
        method: 'PATCH',
        url: '/activities/activity-123',
        payload: { title: 'Updated Title' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).title).toBe('Updated Title');
    });
  });

  describe('DELETE /activities/:id', () => {
    it('should delete an activity', async () => {
      activityService.get.mockResolvedValue(createMockActivity({ tripId: 'trip-123' }));
      activityService.deleteActivity.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/activities/activity-123',
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('POST /trips/:tripId/activities/reorder', () => {
    it('should reorder activities', async () => {
      const reordered = [
        createMockActivity({ id: 'a1', order_index: 0 }),
        createMockActivity({ id: 'a2', order_index: 1 }),
      ];
      activityService.reorder.mockResolvedValue(reordered);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/activities/reorder',
        payload: {
          order: [
            { id: 'a1', orderIndex: 0 },
            { id: 'a2', orderIndex: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(2);
    });
  });
});
