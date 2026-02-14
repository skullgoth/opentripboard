import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createMockSuggestion } from '../../helpers.js';

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

describe('Suggestions Routes', () => {
  let app;
  let suggestionService;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../src/services/suggestion-service.js', () => ({
      createSuggestion: vi.fn(),
      getSuggestions: vi.fn(),
      getSuggestion: vi.fn(),
      voteSuggestion: vi.fn(),
      acceptSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
      updateSuggestion: vi.fn(),
      deleteSuggestion: vi.fn(),
      getSuggestionStats: vi.fn(),
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
    }));

    vi.doMock('../../../src/websocket/rooms.js', () => ({
      broadcastToRoom: vi.fn(),
    }));

    const suggestionsRouter = (await import('../../../src/routes/suggestions.js')).default;
    suggestionService = await import('../../../src/services/suggestion-service.js');

    app = Fastify();
    app.register(suggestionsRouter);
  });

  describe('POST /trips/:tripId/suggestions', () => {
    it('should create a suggestion', async () => {
      const mockSuggestion = createMockSuggestion();
      suggestionService.createSuggestion.mockResolvedValue(mockSuggestion);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/suggestions',
        payload: { activityType: 'restaurant', title: 'Le Cinq' },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).title).toBe('Le Cinq Restaurant');
    });
  });

  describe('GET /trips/:tripId/suggestions', () => {
    it('should return suggestions for a trip', async () => {
      suggestionService.getSuggestions.mockResolvedValue([createMockSuggestion()]);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/suggestions',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });

    it('should filter by status', async () => {
      suggestionService.getSuggestions.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/suggestions?status=accepted',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /suggestions/:id', () => {
    it('should return a single suggestion', async () => {
      suggestionService.getSuggestion.mockResolvedValue(createMockSuggestion());

      const response = await app.inject({
        method: 'GET',
        url: '/suggestions/suggestion-123',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /suggestions/:id/vote', () => {
    it('should vote on a suggestion', async () => {
      const voted = createMockSuggestion({ tripId: 'trip-123' });
      suggestionService.voteSuggestion.mockResolvedValue(voted);

      const response = await app.inject({
        method: 'POST',
        url: '/suggestions/suggestion-123/vote',
        payload: { vote: 'up' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /suggestions/:id/accept', () => {
    it('should accept a suggestion and create activity', async () => {
      suggestionService.acceptSuggestion.mockResolvedValue({
        suggestion: createMockSuggestion({ status: 'accepted', tripId: 'trip-123' }),
        activity: { id: 'activity-new', title: 'Le Cinq Restaurant' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/suggestions/suggestion-123/accept',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.suggestion).toBeDefined();
      expect(body.activity).toBeDefined();
    });
  });

  describe('POST /suggestions/:id/reject', () => {
    it('should reject a suggestion', async () => {
      suggestionService.rejectSuggestion.mockResolvedValue(
        createMockSuggestion({ status: 'rejected', tripId: 'trip-123' })
      );

      const response = await app.inject({
        method: 'POST',
        url: '/suggestions/suggestion-123/reject',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('PATCH /suggestions/:id', () => {
    it('should update a suggestion', async () => {
      const updated = createMockSuggestion({ title: 'Updated', tripId: 'trip-123' });
      suggestionService.updateSuggestion.mockResolvedValue(updated);

      const response = await app.inject({
        method: 'PATCH',
        url: '/suggestions/suggestion-123',
        payload: { title: 'Updated' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /suggestions/:id', () => {
    it('should delete a suggestion', async () => {
      suggestionService.getSuggestion.mockResolvedValue(
        createMockSuggestion({ tripId: 'trip-123' })
      );
      suggestionService.deleteSuggestion.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/suggestions/suggestion-123',
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('GET /trips/:tripId/suggestions/stats', () => {
    it('should return suggestion stats', async () => {
      suggestionService.getSuggestionStats.mockResolvedValue({
        total: 10,
        pending: 5,
        accepted: 3,
        rejected: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/suggestions/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.total).toBe(10);
    });
  });
});
