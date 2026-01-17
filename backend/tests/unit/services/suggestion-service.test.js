/**
 * Comprehensive Unit tests for Suggestion Service
 * Tests all suggestion-related business logic including CRUD, voting, acceptance/rejection, and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as suggestionService from '../../../src/services/suggestion-service.js';
import * as suggestionQueries from '../../../src/db/queries/suggestions.js';
import * as activityQueries from '../../../src/db/queries/activities.js';
import * as tripBuddyService from '../../../src/services/trip-buddy-service.js';
import { createMockSuggestion, createMockActivity } from '../../helpers.js';

// Mock the database connection, queries and services
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/suggestions.js');
vi.mock('../../../src/db/queries/activities.js');
vi.mock('../../../src/services/trip-buddy-service.js');

describe('Suggestion Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSuggestion', () => {
    const tripId = 'trip-123';
    const userId = 'user-456';
    const validSuggestionData = {
      activityType: 'restaurant',
      title: 'Le Cinq Restaurant',
      description: 'Fine dining experience',
      location: 'Paris, France',
      latitude: 48.8584,
      longitude: 2.2945,
      startTime: '2024-06-02T19:00:00Z',
      endTime: '2024-06-02T21:00:00Z',
    };

    it('should create a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion(validSuggestionData);

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findSimilar).mockResolvedValue(null);
      vi.mocked(suggestionQueries.create).mockResolvedValue(mockSuggestion);

      const result = await suggestionService.createSuggestion(tripId, userId, validSuggestionData);

      expect(result).toBeDefined();
      expect(result.title).toBe('Le Cinq Restaurant');
      expect(suggestionQueries.create).toHaveBeenCalled();
    });

    it('should throw ValidationError for missing title', async () => {
      const invalidData = { ...validSuggestionData, title: '' };

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Suggestion title is required');
    });

    it('should throw ValidationError for whitespace-only title', async () => {
      const invalidData = { ...validSuggestionData, title: '   ' };

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Suggestion title is required');
    });

    it('should throw ValidationError for missing activity type', async () => {
      const invalidData = { ...validSuggestionData, activityType: null };

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity type is required');
    });

    it('should throw ValidationError for invalid activity type', async () => {
      const invalidData = { ...validSuggestionData, activityType: 'invalid-type' };

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Activity type must be one of:');
    });

    it('should throw AuthorizationError if user has no access to trip', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(suggestionService.createSuggestion(tripId, userId, validSuggestionData))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should throw ValidationError when end time is before start time', async () => {
      const invalidData = {
        ...validSuggestionData,
        startTime: '2024-06-02T21:00:00Z',
        endTime: '2024-06-02T19:00:00Z',
      };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('End time must be after start time');
    });

    it('should throw ValidationError for latitude without longitude', async () => {
      const invalidData = { ...validSuggestionData, latitude: 48.8584, longitude: undefined };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Both latitude and longitude must be provided together');
    });

    it('should throw ValidationError for longitude without latitude', async () => {
      const invalidData = { ...validSuggestionData, latitude: undefined, longitude: 2.2945 };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Both latitude and longitude must be provided together');
    });

    it('should throw ValidationError for latitude out of range', async () => {
      const invalidData = { ...validSuggestionData, latitude: 95 };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Latitude must be between -90 and 90');
    });

    it('should throw ValidationError for longitude out of range', async () => {
      const invalidData = { ...validSuggestionData, longitude: 185 };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);

      await expect(suggestionService.createSuggestion(tripId, userId, invalidData))
        .rejects
        .toThrow('Longitude must be between -180 and 180');
    });

    it('should throw ValidationError for duplicate suggestion', async () => {
      const existingSuggestion = createMockSuggestion({ title: 'Le Cinq Restaurant' });

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findSimilar).mockResolvedValue(existingSuggestion);

      await expect(suggestionService.createSuggestion(tripId, userId, validSuggestionData))
        .rejects
        .toThrow('You have already suggested a similar activity');
    });

    it('should accept all valid activity types', async () => {
      const validTypes = ['flight', 'accommodation', 'restaurant', 'attraction', 'transportation', 'meeting', 'event', 'other'];

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findSimilar).mockResolvedValue(null);

      for (const activityType of validTypes) {
        const mockSuggestion = createMockSuggestion({ activityType });
        vi.mocked(suggestionQueries.create).mockResolvedValue(mockSuggestion);

        const result = await suggestionService.createSuggestion(tripId, userId, { ...validSuggestionData, activityType });
        expect(result).toBeDefined();
      }
    });

    it('should create suggestion without optional fields', async () => {
      const minimalData = { activityType: 'restaurant', title: 'Simple Restaurant' };
      const mockSuggestion = createMockSuggestion(minimalData);

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findSimilar).mockResolvedValue(null);
      vi.mocked(suggestionQueries.create).mockResolvedValue(mockSuggestion);

      const result = await suggestionService.createSuggestion(tripId, userId, minimalData);

      expect(result).toBeDefined();
      expect(suggestionQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId,
          suggestedByUserId: userId,
          activityType: 'restaurant',
          title: 'Simple Restaurant',
          description: null,
          location: null,
          latitude: null,
          longitude: null,
        })
      );
    });

    it('should trim title and other string fields', async () => {
      const dataWithSpaces = {
        ...validSuggestionData,
        title: '  Trimmed Title  ',
        description: '  Trimmed description  ',
        location: '  Trimmed location  ',
      };
      const mockSuggestion = createMockSuggestion(dataWithSpaces);

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findSimilar).mockResolvedValue(null);
      vi.mocked(suggestionQueries.create).mockResolvedValue(mockSuggestion);

      await suggestionService.createSuggestion(tripId, userId, dataWithSpaces);

      expect(suggestionQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Trimmed Title',
          description: 'Trimmed description',
          location: 'Trimmed location',
        })
      );
    });
  });

  describe('getSuggestions', () => {
    const tripId = 'trip-123';
    const userId = 'user-456';

    it('should get all suggestions for a trip with votes', async () => {
      const mockSuggestions = [
        createMockSuggestion({ id: 'suggestion-1' }),
        createMockSuggestion({ id: 'suggestion-2' }),
      ];
      const mockVoteSummary = { upvotes: 3, downvotes: 1, total_votes: 4 };

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue(mockSuggestions);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(mockVoteSummary);

      const result = await suggestionService.getSuggestions(tripId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].upvotes).toBe(3);
      expect(result[0].downvotes).toBe(1);
      expect(result[0].totalVotes).toBe(4);
    });

    it('should throw AuthorizationError if user has no access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(suggestionService.getSuggestions(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });

    it('should return empty array if no suggestions', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue([]);

      const result = await suggestionService.getSuggestions(tripId, userId);

      expect(result).toEqual([]);
    });

    it('should filter suggestions by status', async () => {
      const pendingSuggestions = [createMockSuggestion({ status: 'pending' })];

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue(pendingSuggestions);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue({ upvotes: 0, downvotes: 0, total_votes: 0 });

      const result = await suggestionService.getSuggestions(tripId, userId, 'pending');

      expect(suggestionQueries.findByTripId).toHaveBeenCalledWith(tripId, 'pending');
    });

    it('should handle null vote summary', async () => {
      const mockSuggestions = [createMockSuggestion({ id: 'suggestion-1' })];

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue(mockSuggestions);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(null);

      const result = await suggestionService.getSuggestions(tripId, userId);

      expect(result[0].upvotes).toBe(0);
      expect(result[0].downvotes).toBe(0);
      expect(result[0].totalVotes).toBe(0);
    });
  });

  describe('getSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-456';

    it('should get a specific suggestion with vote summary', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId });
      const mockVoteSummary = { upvotes: 5, downvotes: 2, total_votes: 7 };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(mockVoteSummary);

      const result = await suggestionService.getSuggestion(suggestionId, userId);

      expect(result.id).toBe(suggestionId);
      expect(result.upvotes).toBe(5);
      expect(result.downvotes).toBe(2);
      expect(result.totalVotes).toBe(7);
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.getSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw AuthorizationError if user has no access to trip', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(suggestionService.getSuggestion(suggestionId, userId))
        .rejects
        .toThrow('You do not have access to this suggestion');
    });
  });

  describe('voteSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-456';

    it('should vote up on a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
      const updatedSuggestion = { ...mockSuggestion };
      const mockVoteSummary = { upvotes: 1, downvotes: 0, total_votes: 1 };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.addVote).mockResolvedValue(updatedSuggestion);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(mockVoteSummary);

      const result = await suggestionService.voteSuggestion(suggestionId, userId, 'up');

      expect(result.upvotes).toBe(1);
      expect(suggestionQueries.addVote).toHaveBeenCalledWith(suggestionId, userId, 'up');
    });

    it('should vote down on a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
      const updatedSuggestion = { ...mockSuggestion };
      const mockVoteSummary = { upvotes: 0, downvotes: 1, total_votes: 1 };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.addVote).mockResolvedValue(updatedSuggestion);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(mockVoteSummary);

      const result = await suggestionService.voteSuggestion(suggestionId, userId, 'down');

      expect(result.downvotes).toBe(1);
      expect(suggestionQueries.addVote).toHaveBeenCalledWith(suggestionId, userId, 'down');
    });

    it('should vote neutral on a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
      const updatedSuggestion = { ...mockSuggestion };
      const mockVoteSummary = { upvotes: 0, downvotes: 0, total_votes: 0 };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.addVote).mockResolvedValue(updatedSuggestion);
      vi.mocked(suggestionQueries.getVoteSummary).mockResolvedValue(mockVoteSummary);

      const result = await suggestionService.voteSuggestion(suggestionId, userId, 'neutral');

      expect(suggestionQueries.addVote).toHaveBeenCalledWith(suggestionId, userId, 'neutral');
    });

    it('should throw ValidationError for invalid vote type', async () => {
      await expect(suggestionService.voteSuggestion(suggestionId, userId, 'invalid'))
        .rejects
        .toThrow('Vote must be "up", "down", or "neutral"');
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.voteSuggestion(suggestionId, userId, 'up'))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw ValidationError if suggestion is not pending', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'accepted' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.voteSuggestion(suggestionId, userId, 'up'))
        .rejects
        .toThrow('Can only vote on pending suggestions');
    });

    it('should throw AuthorizationError if user has no access to trip', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(suggestionService.voteSuggestion(suggestionId, userId, 'up'))
        .rejects
        .toThrow('You do not have access to this trip');
    });
  });

  describe('acceptSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-123';

    it('should accept a suggestion and create an activity', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        status: 'pending',
        trip_id: 'trip-123',
        activity_type: 'restaurant',
        title: 'Test Restaurant',
      });
      const mockActivity = createMockActivity();
      const acceptedSuggestion = { ...mockSuggestion, status: 'accepted' };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);
      vi.mocked(suggestionQueries.accept).mockResolvedValue(acceptedSuggestion);

      const result = await suggestionService.acceptSuggestion(suggestionId, userId);

      expect(result.activity).toBeDefined();
      expect(result.suggestion.status).toBe('accepted');
      expect(activityQueries.create).toHaveBeenCalled();
      expect(suggestionQueries.accept).toHaveBeenCalledWith(suggestionId, userId);
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.acceptSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw ValidationError if suggestion is not pending', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'accepted' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.acceptSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion has already been resolved');
    });

    it('should throw AuthorizationError if user is not owner or editor', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(suggestionService.acceptSuggestion(suggestionId, userId))
        .rejects
        .toThrow('You do not have permission to accept suggestions');
    });

    it('should not allow a user with the viewer role to accept a suggestion', async () => {
        const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
  
        vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(suggestionService.acceptSuggestion(suggestionId, userId))
          .rejects
          .toThrow('You do not have permission to accept suggestions');
      });

    it('should create activity with metadata linking to original suggestion', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        status: 'pending',
        trip_id: 'trip-123',
        suggested_by_user_id: 'suggester-user',
      });
      const mockActivity = createMockActivity();
      const acceptedSuggestion = { ...mockSuggestion, status: 'accepted' };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(activityQueries.create).mockResolvedValue(mockActivity);
      vi.mocked(suggestionQueries.accept).mockResolvedValue(acceptedSuggestion);

      await suggestionService.acceptSuggestion(suggestionId, userId);

      expect(activityQueries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            fromSuggestion: suggestionId,
            suggestedBy: 'suggester-user',
          }),
        })
      );
    });
  });

  describe('rejectSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-123';

    it('should reject a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
      const rejectedSuggestion = { ...mockSuggestion, status: 'rejected' };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(suggestionQueries.reject).mockResolvedValue(rejectedSuggestion);

      const result = await suggestionService.rejectSuggestion(suggestionId, userId);

      expect(result.status).toBe('rejected');
      expect(suggestionQueries.reject).toHaveBeenCalledWith(suggestionId, userId);
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.rejectSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw ValidationError if suggestion is not pending', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'rejected' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.rejectSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion has already been resolved');
    });

    it('should throw AuthorizationError if user is not owner or editor', async () => {
      const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(suggestionService.rejectSuggestion(suggestionId, userId))
        .rejects
        .toThrow('You do not have permission to reject suggestions');
    });

    it('should not allow a user with the viewer role to reject a suggestion', async () => {
        const mockSuggestion = createMockSuggestion({ id: suggestionId, status: 'pending' });
  
        vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(suggestionService.rejectSuggestion(suggestionId, userId))
          .rejects
          .toThrow('You do not have permission to reject suggestions');
      });
  });

  describe('updateSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-456';
    const updates = { title: 'Updated Restaurant Name' };

    it('should update a suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: userId,
        status: 'pending',
      });
      const updatedSuggestion = { ...mockSuggestion, title: 'Updated Restaurant Name' };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(suggestionQueries.update).mockResolvedValue(updatedSuggestion);

      const result = await suggestionService.updateSuggestion(suggestionId, userId, updates);

      expect(result.title).toBe('Updated Restaurant Name');
      expect(suggestionQueries.update).toHaveBeenCalledWith(suggestionId, updates);
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.updateSuggestion(suggestionId, userId, updates))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw AuthorizationError if user is not the creator', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: 'other-user',
        status: 'pending',
      });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.updateSuggestion(suggestionId, userId, updates))
        .rejects
        .toThrow('You can only update your own suggestions');
    });

    it('should throw ValidationError if suggestion is not pending', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: userId,
        status: 'accepted',
      });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.updateSuggestion(suggestionId, userId, updates))
        .rejects
        .toThrow('Can only update pending suggestions');
    });

    it('should throw ValidationError for empty title in update', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: userId,
        status: 'pending',
      });
      const invalidUpdates = { title: '' };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.updateSuggestion(suggestionId, userId, invalidUpdates))
        .rejects
        .toThrow('Suggestion title cannot be empty');
    });

    it('should throw ValidationError when end time is before start time in update', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: userId,
        status: 'pending',
      });
      const invalidUpdates = {
        startTime: '2024-06-02T21:00:00Z',
        endTime: '2024-06-02T19:00:00Z',
      };

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);

      await expect(suggestionService.updateSuggestion(suggestionId, userId, invalidUpdates))
        .rejects
        .toThrow('End time must be after start time');
    });
  });

  describe('deleteSuggestion', () => {
    const suggestionId = 'suggestion-123';
    const userId = 'user-456';

    it('should delete own suggestion successfully', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: userId,
      });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(suggestionQueries.remove).mockResolvedValue();

      await suggestionService.deleteSuggestion(suggestionId, userId);

      expect(suggestionQueries.remove).toHaveBeenCalledWith(suggestionId);
    });

    it('should allow owner/editor to delete any suggestion', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: 'other-user',
      });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(true);
      vi.mocked(suggestionQueries.remove).mockResolvedValue();

      await suggestionService.deleteSuggestion(suggestionId, userId);

      expect(suggestionQueries.remove).toHaveBeenCalledWith(suggestionId);
    });

    it('should throw NotFoundError if suggestion does not exist', async () => {
      vi.mocked(suggestionQueries.findById).mockResolvedValue(null);

      await expect(suggestionService.deleteSuggestion(suggestionId, userId))
        .rejects
        .toThrow('Suggestion not found');
    });

    it('should throw AuthorizationError if user has no permission', async () => {
      const mockSuggestion = createMockSuggestion({
        id: suggestionId,
        suggested_by_user_id: 'other-user',
      });

      vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
      vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);

      await expect(suggestionService.deleteSuggestion(suggestionId, userId))
        .rejects
        .toThrow('You do not have permission to delete this suggestion');
    });

    it('should not allow a user with no special permissions to delete another user suggestion', async () => {
        const mockSuggestion = createMockSuggestion({
          id: suggestionId,
          suggested_by_user_id: 'other-user',
        });
  
        vi.mocked(suggestionQueries.findById).mockResolvedValue(mockSuggestion);
        vi.mocked(tripBuddyService.checkPermission).mockResolvedValue(false);
  
        await expect(suggestionService.deleteSuggestion(suggestionId, userId))
          .rejects
          .toThrow('You do not have permission to delete this suggestion');
      });
  });

  describe('getSuggestionStats', () => {
    const tripId = 'trip-123';
    const userId = 'user-456';

    it('should get suggestion statistics', async () => {
      const mockSuggestions = [
        createMockSuggestion({ status: 'pending' }),
        createMockSuggestion({ status: 'pending' }),
        createMockSuggestion({ status: 'accepted' }),
        createMockSuggestion({ status: 'rejected' }),
      ];

      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue(mockSuggestions);

      const result = await suggestionService.getSuggestionStats(tripId, userId);

      expect(result.total).toBe(4);
      expect(result.pending).toBe(2);
      expect(result.accepted).toBe(1);
      expect(result.rejected).toBe(1);
    });

    it('should return zero counts for empty trip', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(true);
      vi.mocked(suggestionQueries.findByTripId).mockResolvedValue([]);

      const result = await suggestionService.getSuggestionStats(tripId, userId);

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(0);
    });

    it('should throw AuthorizationError if user has no access', async () => {
      vi.mocked(tripBuddyService.checkAccess).mockResolvedValue(false);

      await expect(suggestionService.getSuggestionStats(tripId, userId))
        .rejects
        .toThrow('You do not have access to this trip');
    });
  });
});
