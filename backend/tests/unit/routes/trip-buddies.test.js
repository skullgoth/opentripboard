
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createMockTripBuddy } from '../../helpers.js';

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

describe('Trip Buddies Routes', () => {
  let app;
  let tripBuddyService;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/services/trip-buddy-service.js', () => ({
      inviteTripBuddy: vi.fn(),
      getTripBuddies: vi.fn(),
      getPendingInvitations: vi.fn(),
      acceptInvitation: vi.fn(),
      updateRole: vi.fn(),
      removeTripBuddy: vi.fn(),
      leaveTrip: vi.fn(),
      getCollaborationStats: vi.fn(),
      getUserRole: vi.fn(),
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
    const tripBuddyRoutes = (await import('../../../src/routes/trip-buddies.js')).default;
    tripBuddyService = await import('../../../src/services/trip-buddy-service.js');

    app = Fastify();
    app.register(tripBuddyRoutes);
  });

  describe('POST /trips/:tripId/trip-buddies', () => {
    it('should invite a trip buddy', async () => {
      const mockTripBuddy = createMockTripBuddy();
      tripBuddyService.inviteTripBuddy.mockResolvedValue(mockTripBuddy);

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/trip-buddies',
        payload: { email: 'test@example.com', role: 'editor' },
      });

      expect(response.statusCode).toBe(201);
      const expectedPayload = {
        ...mockTripBuddy,
        accepted_at: mockTripBuddy.accepted_at.toISOString(),
        created_at: mockTripBuddy.created_at.toISOString(),
        invited_at: mockTripBuddy.invited_at.toISOString(),
        updated_at: mockTripBuddy.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual(expectedPayload);
      expect(tripBuddyService.inviteTripBuddy).toHaveBeenCalledWith(
        'trip-123',
        'user-123',
        'test@example.com',
        'editor'
      );
    });
  });

  describe('GET /trips/:tripId/trip-buddies', () => {
    it('should return a list of trip buddies for a trip', async () => {
      const mockTripBuddies = [createMockTripBuddy()];
      tripBuddyService.getTripBuddies.mockResolvedValue(mockTripBuddies);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/trip-buddies',
      });

      expect(response.statusCode).toBe(200);
      const expectedPayload = mockTripBuddies.map(tb => ({
        ...tb,
        accepted_at: tb.accepted_at.toISOString(),
        created_at: tb.created_at.toISOString(),
        invited_at: tb.invited_at.toISOString(),
        updated_at: tb.updated_at.toISOString(),
      }));
      expect(JSON.parse(response.payload)).toEqual(expectedPayload);
      expect(tripBuddyService.getTripBuddies).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });

  describe('GET /trip-buddies/invitations', () => {
    it('should return a list of pending invitations for the current user', async () => {
      const mockInvitations = [createMockTripBuddy({ status: 'pending' })];
      tripBuddyService.getPendingInvitations.mockResolvedValue(mockInvitations);

      const response = await app.inject({
        method: 'GET',
        url: '/trip-buddies/invitations',
      });

      expect(response.statusCode).toBe(200);
      const expectedPayload = mockInvitations.map(inv => ({
        ...inv,
        accepted_at: inv.accepted_at.toISOString(),
        created_at: inv.created_at.toISOString(),
        invited_at: inv.invited_at.toISOString(),
        updated_at: inv.updated_at.toISOString(),
      }));
      expect(JSON.parse(response.payload)).toEqual(expectedPayload);
      expect(tripBuddyService.getPendingInvitations).toHaveBeenCalledWith('user-123');
    });
  });

  describe('POST /trip-buddies/:id/accept', () => {
    it('should accept a collaboration invitation', async () => {
      const mockTripBuddy = createMockTripBuddy({ accepted_at: new Date() });
      tripBuddyService.acceptInvitation.mockResolvedValue(mockTripBuddy);

      const response = await app.inject({
        method: 'POST',
        url: '/trip-buddies/collab-123/accept',
      });

      expect(response.statusCode).toBe(200);
      const expectedPayload = {
        ...mockTripBuddy,
        accepted_at: mockTripBuddy.accepted_at.toISOString(),
        created_at: mockTripBuddy.created_at.toISOString(),
        invited_at: mockTripBuddy.invited_at.toISOString(),
        updated_at: mockTripBuddy.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual(expectedPayload);
      expect(tripBuddyService.acceptInvitation).toHaveBeenCalledWith('collab-123', 'user-123');
    });
  });

  describe('PATCH /trip-buddies/:id', () => {
    it('should update a trip buddy\'s role', async () => {
      const mockTripBuddy = createMockTripBuddy({ role: 'viewer' });
      tripBuddyService.updateRole.mockResolvedValue(mockTripBuddy);

      const response = await app.inject({
        method: 'PATCH',
        url: '/trip-buddies/collab-123',
        payload: { role: 'viewer' },
      });

      expect(response.statusCode).toBe(200);
      const expectedPayload = {
        ...mockTripBuddy,
        accepted_at: mockTripBuddy.accepted_at.toISOString(),
        created_at: mockTripBuddy.created_at.toISOString(),
        invited_at: mockTripBuddy.invited_at.toISOString(),
        updated_at: mockTripBuddy.updated_at.toISOString(),
      };
      expect(JSON.parse(response.payload)).toEqual(expectedPayload);
      expect(tripBuddyService.updateRole).toHaveBeenCalledWith('collab-123', 'user-123', 'viewer');
    });
  });

  describe('DELETE /trip-buddies/:id', () => {
    it('should remove a trip buddy from a trip', async () => {
      tripBuddyService.removeTripBuddy.mockResolvedValue();

      const response = await app.inject({
        method: 'DELETE',
        url: '/trip-buddies/collab-123',
      });

      expect(response.statusCode).toBe(204);
      expect(tripBuddyService.removeTripBuddy).toHaveBeenCalledWith('collab-123', 'user-123');
    });
  });

  describe('POST /trips/:tripId/leave', () => {
    it('should allow a user to leave a trip', async () => {
      tripBuddyService.leaveTrip.mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/trips/trip-123/leave',
      });

      expect(response.statusCode).toBe(204);
      expect(tripBuddyService.leaveTrip).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });

  describe('GET /trips/:tripId/trip-buddies/stats', () => {
    it('should return collaboration statistics for a trip', async () => {
      const mockStats = {
        totalBuddies: 3,
        editors: 2,
        viewers: 1,
        pendingInvitations: 0,
      };
      tripBuddyService.getCollaborationStats.mockResolvedValue(mockStats);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/trip-buddies/stats',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockStats);
      expect(tripBuddyService.getCollaborationStats).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });

  describe('GET /trips/:tripId/role', () => {
    it('should return the user\'s role on a trip', async () => {
      const mockRole = { role: 'editor' };
      tripBuddyService.getUserRole.mockResolvedValue(mockRole.role);

      const response = await app.inject({
        method: 'GET',
        url: '/trips/trip-123/role',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockRole);
      expect(tripBuddyService.getUserRole).toHaveBeenCalledWith('trip-123', 'user-123');
    });
  });
});
