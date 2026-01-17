/**
 * Unit tests for Trip Buddy Service
 * Tests all collaboration-related business logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tripBuddyService from '../../../src/services/trip-buddy-service.js';
import * as tripBuddyQueries from '../../../src/db/queries/trip-buddies.js';
import * as tripQueries from '../../../src/db/queries/trips.js';
import * as userQueries from '../../../src/db/queries/users.js';
import { createMockTripBuddy, createMockTrip, createMockUser } from '../../helpers.js';

// Mock the database connection and queries
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/trip-buddies.js');
vi.mock('../../../src/db/queries/trips.js');
vi.mock('../../../src/db/queries/users.js');

describe('Trip Buddy Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inviteTripBuddy', () => {
    it('should invite a collaborator successfully', async () => {
      const tripId = 'trip-123';
      const userId = 'user-123';
      const inviteeEmail = 'invitee@example.com';
      const role = 'editor';

      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const mockInvitee = createMockUser({ id: 'user-456', email: inviteeEmail });
      const mockTripBuddy = createMockTripBuddy({ role, user_id: 'user-456' });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockInvitee);
      vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
      vi.mocked(tripBuddyQueries.invite).mockResolvedValue(mockTripBuddy);

      const result = await tripBuddyService.inviteTripBuddy(tripId, userId, inviteeEmail, role);

      expect(result).toBeDefined();
      expect(result.role).toBe('editor');
      expect(tripBuddyQueries.invite).toHaveBeenCalled();
    });

    it('should throw authorization error if user does not have permission', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
        const inviteeEmail = 'invitee@example.com';
        const role = 'editor';
        const nonOwnerUser = createMockUser({ id: 'non-owner-id' });
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'another-user' });
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
        await expect(tripBuddyService.inviteTripBuddy(tripId, nonOwnerUser.id, inviteeEmail, role))
          .rejects
          .toThrow('You do not have permission to invite trip buddies');
      });
  });

  describe('acceptInvitation', () => {
    it('should accept an invitation successfully', async () => {
      const tripBuddyId = 'collab-123';
      const userId = 'user-456';

      const mockTripBuddy = createMockTripBuddy({
        id: tripBuddyId,
        user_id: userId,
        accepted_at: null
      });
      const acceptedTripBuddy = { ...mockTripBuddy, accepted_at: new Date() };

      vi.mocked(tripBuddyQueries.findById).mockResolvedValue(mockTripBuddy);
      vi.mocked(tripBuddyQueries.markAsAccepted).mockResolvedValue(acceptedTripBuddy);

      const result = await tripBuddyService.acceptInvitation(tripBuddyId, userId);

      expect(result.acceptedAt).toBeDefined();
      expect(tripBuddyQueries.markAsAccepted).toHaveBeenCalledWith(tripBuddyId);
    });
  });

  describe('getTripBuddies', () => {
    it('should get all collaborators for a trip', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
  
        const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
        const mockTripBuddys = [
          createMockTripBuddy({ id: 'collab-1' }),
          createMockTripBuddy({ id: 'collab-2' }),
        ];
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripId).mockResolvedValue(mockTripBuddys);
  
        const result = await tripBuddyService.getTripBuddies(tripId, userId);
  
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('collab-1');
        expect(result[1].id).toBe('collab-2');
      });

    it('should throw an authorization error if the user does not have access to the trip', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'another-user' });
        const nonOwnerUser = createMockUser({ id: 'non-owner-id' });
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
        await expect(tripBuddyService.getTripBuddies(tripId, nonOwnerUser.id))
            .rejects
            .toThrow('You do not have access to this trip');
    });
  });

  describe('getPendingInvitations', () => {
    it('should get pending invitations for a user', async () => {
      const userId = 'user-456';
      const mockInvitations = [
        createMockTripBuddy({ id: 'collab-1', accepted_at: null }),
        createMockTripBuddy({ id: 'collab-2', accepted_at: null }),
      ];

      vi.mocked(tripBuddyQueries.findPendingInvitations).mockResolvedValue(mockInvitations);

      const result = await tripBuddyService.getPendingInvitations(userId);

      expect(result).toHaveLength(2);
      expect(tripBuddyQueries.findPendingInvitations).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateRole', () => {
    it('should update collaborator role successfully', async () => {
        const tripBuddyId = 'collab-123';
        const userId = 'user-123';
        const newRole = 'viewer';
  
        const mockTripBuddy = createMockTripBuddy({ id: tripBuddyId });
        const mockTrip = createMockTrip({ owner_id: userId });
        const updatedCollaborator = { ...mockTripBuddy, role: 'viewer' };
  
        vi.mocked(tripBuddyQueries.findById).mockResolvedValue(mockTripBuddy);
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.updateRole).mockResolvedValue(updatedCollaborator);
  
        const result = await tripBuddyService.updateRole(tripBuddyId, userId, newRole);
  
        expect(result.role).toBe('viewer');
        expect(tripBuddyQueries.updateRole).toHaveBeenCalledWith(tripBuddyId, newRole);
      });

    it('should throw authorization error if user does not have permission', async () => {
        const tripBuddyId = 'collab-123';
        const userId = 'user-123';
        const newRole = 'viewer';
  
        const mockTripBuddy = createMockTripBuddy({ id: tripBuddyId });
        const mockTrip = createMockTrip({ owner_id: 'another-user' });
  
        vi.mocked(tripBuddyQueries.findById).mockResolvedValue(mockTripBuddy);
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
  
        await expect(tripBuddyService.updateRole(tripBuddyId, userId, newRole))
            .rejects
            .toThrow('You do not have permission to update tripBuddy roles');
    });
  });

  describe('removeTripBuddy', () => {
    it('should remove a collaborator successfully', async () => {
        const tripBuddyId = 'collab-123';
        const userId = 'user-123';
  
        const mockTripBuddy = createMockTripBuddy({ id: tripBuddyId });
        const mockTrip = createMockTrip({ owner_id: userId });
  
        vi.mocked(tripBuddyQueries.findById).mockResolvedValue(mockTripBuddy);
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.remove).mockResolvedValue();
  
        await tripBuddyService.removeTripBuddy(tripBuddyId, userId);
  
        expect(tripBuddyQueries.remove).toHaveBeenCalledWith(tripBuddyId);
      });

    it('should throw authorization error if user does not have permission', async () => {
        const tripBuddyId = 'collab-123';
        const userId = 'user-123';
  
        const mockTripBuddy = createMockTripBuddy({ id: tripBuddyId });
        const mockTrip = createMockTrip({ owner_id: 'another-user' });
  
        vi.mocked(tripBuddyQueries.findById).mockResolvedValue(mockTripBuddy);
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
  
        await expect(tripBuddyService.removeTripBuddy(tripBuddyId, userId))
            .rejects
            .toThrow('You do not have permission to remove this tripBuddy');
    });
  });

  describe('leaveTrip', () => {
    it('should allow a user to leave a trip', async () => {
      const tripId = 'trip-123';
      const userId = 'user-456';

      const mockTripBuddy = createMockTripBuddy({ trip_id: tripId, user_id: userId });

      vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(mockTripBuddy);
      vi.mocked(tripBuddyQueries.remove).mockResolvedValue();

      await tripBuddyService.leaveTrip(tripId, userId);

      expect(tripBuddyQueries.remove).toHaveBeenCalledWith(mockTripBuddy.id);
    });
  });

  describe('checkAccess', () => {
    it('should return true if user is owner', async () => {
      const tripId = 'trip-123';
      const userId = 'user-123';

      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);

      const result = await tripBuddyService.checkAccess(tripId, userId);

      expect(result).toBe(true);
    });

    it('should return true if user is accepted collaborator', async () => {
      const tripId = 'trip-123';
      const userId = 'user-456';

      const mockTrip = createMockTrip({ id: tripId, owner_id: 'user-123' });
      const mockTripBuddy = createMockTripBuddy({
        trip_id: tripId,
        user_id: userId,
        accepted_at: new Date()
      });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(mockTripBuddy);

      const result = await tripBuddyService.checkAccess(tripId, userId);

      expect(result).toBe(true);
    });

    it('should return false if user is not owner or collaborator', async () => {
        const tripId = 'trip-123';
        const userId = 'user-456';
  
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'user-123' });
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
  
        const result = await tripBuddyService.checkAccess(tripId, userId);
  
        expect(result).toBe(false);
      });
  });

  describe('checkPermission', () => {
    it('should check user permissions correctly', async () => {
      const tripId = 'trip-123';
      const userId = 'user-123';
      const allowedRoles = ['owner', 'editor'];

      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);

      const result = await tripBuddyService.checkPermission(tripId, userId, allowedRoles);

      expect(result).toBe(true);
    });

    it('should return false if user is not owner and not a buddy', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
        const allowedRoles = ['editor'];
  
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'another-user' });
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
  
        const result = await tripBuddyService.checkPermission(tripId, userId, allowedRoles);
  
        expect(result).toBe(false);
      });
  });

  describe('getUserRole', () => {
    it('should return owner role for trip owner', async () => {
      const tripId = 'trip-123';
      const userId = 'user-123';

      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);

      const result = await tripBuddyService.getUserRole(tripId, userId);

      expect(result).toBe('owner');
    });

    it('should return collaborator role for accepted collaborator', async () => {
      const tripId = 'trip-123';
      const userId = 'user-456';

      const mockTrip = createMockTrip({ id: tripId, owner_id: 'user-123' });
      const mockTripBuddy = createMockTripBuddy({
        trip_id: tripId,
        user_id: userId,
        role: 'editor',
        accepted_at: new Date()
      });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(mockTripBuddy);

      const result = await tripBuddyService.getUserRole(tripId, userId);

      expect(result).toBe('editor');
    });
  });

  describe('getCollaborationStats', () => {
      it('should get collaboration statistics', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
  
        const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
        const mockTripBuddys = [
            createMockTripBuddy({ accepted_at: new Date() }),
            createMockTripBuddy({ accepted_at: new Date() }),
            createMockTripBuddy({ accepted_at: null }),
        ];
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.countByTripId).mockResolvedValue(3);
        vi.mocked(tripBuddyQueries.findByTripId).mockResolvedValue(mockTripBuddys);
  
        const result = await tripBuddyService.getTripBuddyStats(tripId, userId);
  
        expect(result.total).toBe(3);
        expect(result.accepted).toBe(2);
        expect(result.pending).toBe(1);
      });

      it('should throw an authorization error if the user does not have access to the trip', async () => {
        const tripId = 'trip-123';
        const userId = 'user-123';
  
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'another-user' });
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyQueries.findByTripAndUser).mockResolvedValue(null);
  
        await expect(tripBuddyService.getTripBuddyStats(tripId, userId))
            .rejects
            .toThrow('You do not have access to this trip');
    });
  });
});

