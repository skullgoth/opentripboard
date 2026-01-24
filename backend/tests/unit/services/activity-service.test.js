/**
 * Comprehensive Unit tests for Activity Service
 * Tests all activity-related business logic including CRUD, validation, authorization, and reordering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as activityService from '../../../src/services/activity-service.js';
import * as activityQueries from '../../../src/db/queries/activities.js';
import * as tripQueries from '../../../src/db/queries/trips.js';
import * as tripBuddyService from '../../../src/services/trip-buddy-service.js';
import { createMockActivity, createMockTrip } from '../../helpers.js';

// Mock the database connection and queries
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/activities.js');
vi.mock('../../../src/db/queries/trips.js');
vi.mock('../../../src/services/trip-buddy-service.js');

describe('Activity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const tripId = 'trip-123';
    const userId = 'user-123';
    const validActivityData = {
      type: 'attraction',
      title: 'Visit Eiffel Tower',
      description: 'Iconic landmark visit',
      location: 'Champ de Mars, Paris',
      latitude: 48.858844,
      longitude: 2.294351,
      startTime: '2024-06-02T10:00:00Z',
      endTime: '2024-06-02T12:00:00Z',
      orderIndex: 0,
      metadata: { ticketRequired: true },
    };

    it('should create an activity successfully', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const mockActivity = createMockActivity(validActivityData);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      const result = await activityService.create(tripId, userId, validActivityData);

      expect(result).toBeDefined();
      expect(result.title).toBe('Visit Eiffel Tower');
      expect(activityQueries.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError if trip does not exist', async () => {
      vi.mocked(tripQueries.findById).mockResolvedValue(null);

      await expect(activityService.create(tripId, userId, validActivityData))
        .rejects
        .toThrow('Trip not found');
    });

    it('should throw AuthorizationError if user has no edit permission', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(activityService.create(tripId, userId, validActivityData))
        .rejects
        .toThrow('You do not have permission to add activities to this trip');
    });

    it('should not allow a user with the viewer role to create an activity', async () => {
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(activityService.create(tripId, userId, validActivityData))
          .rejects
          .toThrow('You do not have permission to add activities to this trip');
      });

    it('should throw ValidationError for invalid activity type', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, type: 'invalid-type' };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity type must be a valid default type or a custom category reference (custom:uuid)');
    });

    it('should throw ValidationError for missing activity type', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, type: null };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity type must be a valid default type or a custom category reference (custom:uuid)');
    });

    it('should accept custom category types', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const customCategoryData = { ...validActivityData, type: 'custom:11111111-2222-3333-4444-555555555555' };
      const mockActivity = createMockActivity(customCategoryData);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      const result = await activityService.create(tripId, userId, customCategoryData);

      expect(result).toBeDefined();
      expect(activityQueries.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for missing title', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, title: '' };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity title is required');
    });

    it('should throw ValidationError for whitespace-only title', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, title: '   ' };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity title is required');
    });

    it('should throw ValidationError when end time is before start time', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = {
        ...validActivityData,
        startTime: '2024-06-02T14:00:00Z',
        endTime: '2024-06-02T10:00:00Z',
      };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('End time must be after start time');
    });

    it('should throw ValidationError for latitude out of range (too high)', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, latitude: 95 };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Latitude must be between -90 and 90');
    });

    it('should throw ValidationError for latitude out of range (too low)', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, latitude: -95 };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Latitude must be between -90 and 90');
    });

    it('should throw ValidationError for longitude out of range (too high)', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, longitude: 185 };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Longitude must be between -180 and 180');
    });

    it('should throw ValidationError for longitude out of range (too low)', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const invalidData = { ...validActivityData, longitude: -185 };

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.create(tripId, userId, invalidData))
        .rejects
        .toThrow('Longitude must be between -180 and 180');
    });

    it('should accept all valid activity types', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const validTypes = ['flight', 'accommodation', 'restaurant', 'attraction', 'transportation', 'meeting', 'event', 'other'];

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      for (const type of validTypes) {
        const mockActivity = createMockActivity({ ...validActivityData, type });
        vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

        const result = await activityService.create(tripId, userId, { ...validActivityData, type });
        expect(result).toBeDefined();
      }
    });

    it('should create activity without optional fields', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const minimalData = { type: 'other', title: 'Simple Activity' };
      const mockActivity = createMockActivity(minimalData);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      const result = await activityService.create(tripId, userId, minimalData);

      expect(result).toBeDefined();
      expect(activityQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId,
          type: 'other',
          title: 'Simple Activity',
          description: null,
          location: null,
          latitude: null,
          longitude: null,
          startTime: null,
          endTime: null,
        })
      );
    });

    it('should trim title and other string fields', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const dataWithSpaces = {
        type: 'attraction',
        title: '  Trimmed Title  ',
        description: '  Trimmed description  ',
        location: '  Trimmed location  ',
      };
      const mockActivity = createMockActivity(dataWithSpaces);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      await activityService.create(tripId, userId, dataWithSpaces);

      expect(activityQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Trimmed Title',
          description: 'Trimmed description',
          location: 'Trimmed location',
        })
      );
    });

    it('should track activity creator', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const mockActivity = createMockActivity(validActivityData);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      await activityService.create(tripId, userId, validActivityData);

      expect(activityQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: userId,
        })
      );
    });

    it('should use default orderIndex if not provided', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const dataWithoutOrder = { type: 'other', title: 'Test' };
      const mockActivity = createMockActivity(dataWithoutOrder);

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);

      await activityService.create(tripId, userId, dataWithoutOrder);

      expect(activityQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderIndex: 0,
        })
      );
    });
  });

  describe('listByTrip', () => {
    const tripId = 'trip-123';
    const userId = 'user-123';

    it('should list all activities for a trip', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const mockActivities = [
        createMockActivity({ id: 'activity-1', trip_id: tripId }),
        createMockActivity({ id: 'activity-2', trip_id: tripId }),
      ];

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(activityQueries.findByTripId).mockResolvedValue(mockActivities);

      const result = await activityService.listByTrip(tripId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('activity-1');
      expect(result[1].id).toBe('activity-2');
    });

    it('should throw NotFoundError if trip does not exist', async () => {
      vi.mocked(tripQueries.findById).mockResolvedValue(null);

      await expect(activityService.listByTrip(tripId, userId))
        .rejects
        .toThrow('Trip not found');
    });

    it('should throw AuthorizationError if user has no access', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(activityService.listByTrip(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should return empty array if no activities', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(activityQueries.findByTripId).mockResolvedValue([]);

      const result = await activityService.listByTrip(tripId, userId);

      expect(result).toEqual([]);
    });

    it('should format activities with all fields', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const mockActivities = [
        createMockActivity({
          id: 'activity-1',
          latitude: '48.858844',
          longitude: '2.294351',
          order_index: 0,
          created_by: 'user-123',
          created_by_name: 'Test User',
        }),
      ];

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(activityQueries.findByTripId).mockResolvedValue(mockActivities);

      const result = await activityService.listByTrip(tripId, userId);

      expect(result[0].latitude).toBe(48.858844);
      expect(result[0].longitude).toBe(2.294351);
      expect(result[0].orderIndex).toBe(0);
      expect(result[0].createdBy).toBe('user-123');
    });
  });

  describe('get', () => {
    const activityId = 'activity-123';
    const userId = 'user-123';
    const tripId = 'trip-123';

    it('should get an activity by ID', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      const result = await activityService.get(activityId, userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(activityId);
    });

    it('should throw NotFoundError if activity does not exist', async () => {
      vi.mocked(activityQueries.findById).mockResolvedValue(null);

      await expect(activityService.get(activityId, userId))
        .rejects
        .toThrow('Activity not found');
    });

    it('should throw AuthorizationError if user has no access to trip', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(activityService.get(activityId, userId))
        .rejects
        .toThrow('You do not have access to this activity');
    });

    it('should parse latitude and longitude as floats', async () => {
      const mockActivity = createMockActivity({
        id: activityId,
        trip_id: tripId,
        latitude: '48.858844',
        longitude: '2.294351',
      });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      const result = await activityService.get(activityId, userId);

      expect(typeof result.latitude).toBe('number');
      expect(typeof result.longitude).toBe('number');
      expect(result.latitude).toBe(48.858844);
    });
  });

  describe('update', () => {
    const activityId = 'activity-123';
    const userId = 'user-123';
    const tripId = 'trip-123';
    const updates = { title: 'Updated Activity Title' };

    it('should update an activity successfully', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const updatedActivity = { ...mockActivity, title: 'Updated Activity Title' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.update).mockResolvedValue(updatedActivity);

      const result = await activityService.update(activityId, userId, updates);

      expect(result.title).toBe('Updated Activity Title');
      expect(activityQueries.update).toHaveBeenCalledWith(activityId, updates, userId);
    });

    it('should throw NotFoundError if activity does not exist', async () => {
      vi.mocked(activityQueries.findById).mockResolvedValue(null);

      await expect(activityService.update(activityId, userId, updates))
        .rejects
        .toThrow('Activity not found');
    });

    it('should throw AuthorizationError if user has no edit permission', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(activityService.update(activityId, userId, updates))
        .rejects
        .toThrow('You do not have permission to update this activity');
    });

    it('should not allow a user with the viewer role to update an activity', async () => {
        const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
  
        vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(activityService.update(activityId, userId, updates))
          .rejects
          .toThrow('You do not have permission to update this activity');
      });

    it('should throw ValidationError for invalid activity type in update', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const invalidUpdates = { type: 'invalid-type' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.update(activityId, userId, invalidUpdates))
        .rejects
        .toThrow('Activity type must be a valid default type or a custom category reference (custom:uuid)');
    });

    it('should accept custom category types in update', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const customUpdates = { type: 'custom:11111111-2222-3333-4444-555555555555' };
      const updatedActivity = { ...mockActivity, type: 'custom:11111111-2222-3333-4444-555555555555' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.update).mockResolvedValue(updatedActivity);

      const result = await activityService.update(activityId, userId, customUpdates);

      expect(result.type).toBe('custom:11111111-2222-3333-4444-555555555555');
    });

    it('should throw ValidationError for empty title in update', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const invalidUpdates = { title: '' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.update(activityId, userId, invalidUpdates))
        .rejects
        .toThrow('Activity title cannot be empty');
    });

    it('should throw ValidationError when end time is before start time in update', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const invalidUpdates = {
        startTime: '2024-06-02T14:00:00Z',
        endTime: '2024-06-02T10:00:00Z',
      };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.update(activityId, userId, invalidUpdates))
        .rejects
        .toThrow('End time must be after start time');
    });

    it('should allow partial updates', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const partialUpdates = { description: 'Updated description' };
      const updatedActivity = { ...mockActivity, description: 'Updated description' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.update).mockResolvedValue(updatedActivity);

      const result = await activityService.update(activityId, userId, partialUpdates);

      expect(result.description).toBe('Updated description');
    });

    it('should track who updated the activity', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
      const updatedActivity = { ...mockActivity, title: 'New Title' };

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.update).mockResolvedValue(updatedActivity);

      await activityService.update(activityId, userId, { title: 'New Title' });

      expect(activityQueries.update).toHaveBeenCalledWith(activityId, { title: 'New Title' }, userId);
    });
  });

  describe('deleteActivity', () => {
    const activityId = 'activity-123';
    const userId = 'user-123';
    const tripId = 'trip-123';

    it('should delete an activity successfully', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.deleteActivity).mockResolvedValue();

      await activityService.deleteActivity(activityId, userId);

      expect(activityQueries.deleteActivity).toHaveBeenCalledWith(activityId);
    });

    it('should throw NotFoundError if activity does not exist', async () => {
      vi.mocked(activityQueries.findById).mockResolvedValue(null);

      await expect(activityService.deleteActivity(activityId, userId))
        .rejects
        .toThrow('Activity not found');
    });

    it('should throw AuthorizationError if user has no edit permission', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(activityService.deleteActivity(activityId, userId))
        .rejects
        .toThrow('You do not have permission to delete this activity');
    });

    it('should not allow a user with the viewer role to delete an activity', async () => {
        const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });
  
        vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(activityService.deleteActivity(activityId, userId))
          .rejects
          .toThrow('You do not have permission to delete this activity');
      });

    it('should allow editor to delete activity', async () => {
      const mockActivity = createMockActivity({ id: activityId, trip_id: tripId });

      vi.mocked(activityQueries.findById).mockResolvedValue(mockActivity);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true); // Editor has permission
      vi.mocked(activityQueries.deleteActivity).mockResolvedValue();

      await activityService.deleteActivity(activityId, userId);

      expect(activityQueries.deleteActivity).toHaveBeenCalledWith(activityId);
    });
  });

  describe('reorder', () => {
    const tripId = 'trip-123';
    const userId = 'user-123';
    const orderUpdates = [
      { id: 'activity-1', orderIndex: 0 },
      { id: 'activity-2', orderIndex: 1 },
      { id: 'activity-3', orderIndex: 2 },
    ];

    it('should reorder activities successfully', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });
      const reorderedActivities = [
        createMockActivity({ id: 'activity-1', order_index: 0 }),
        createMockActivity({ id: 'activity-2', order_index: 1 }),
        createMockActivity({ id: 'activity-3', order_index: 2 }),
      ];

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.reorder).mockResolvedValue(reorderedActivities);

      const result = await activityService.reorder(tripId, userId, orderUpdates);

      expect(result).toHaveLength(3);
      expect(result[0].orderIndex).toBe(0);
      expect(result[1].orderIndex).toBe(1);
      expect(result[2].orderIndex).toBe(2);
    });

    it('should throw NotFoundError if trip does not exist', async () => {
      vi.mocked(tripQueries.findById).mockResolvedValue(null);

      await expect(activityService.reorder(tripId, userId, orderUpdates))
        .rejects
        .toThrow('Trip not found');
    });

    it('should throw AuthorizationError if user has no edit permission', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(activityService.reorder(tripId, userId, orderUpdates))
        .rejects
        .toThrow('You do not have permission to reorder activities');
    });

    it('should not allow a user with the viewer role to reorder activities', async () => {
        const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });
  
        vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(activityService.reorder(tripId, userId, orderUpdates))
          .rejects
          .toThrow('You do not have permission to reorder activities');
      });

    it('should throw ValidationError for empty order updates', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.reorder(tripId, userId, []))
        .rejects
        .toThrow('Order updates must be a non-empty array');
    });

    it('should throw ValidationError for non-array order updates', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: userId });

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);

      await expect(activityService.reorder(tripId, userId, null))
        .rejects
        .toThrow('Order updates must be a non-empty array');
    });

    it('should allow editor to reorder activities', async () => {
      const mockTrip = createMockTrip({ id: tripId, owner_id: 'other-user' });
      const reorderedActivities = [
        createMockActivity({ id: 'activity-1', order_index: 0 }),
      ];

      vi.mocked(tripQueries.findById).mockResolvedValue(mockTrip);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true); // Editor has permission
      vi.mocked(activityQueries.reorder).mockResolvedValue(reorderedActivities);

      const result = await activityService.reorder(tripId, userId, [{ id: 'activity-1', orderIndex: 0 }]);

      expect(result).toHaveLength(1);
    });
  });
});
