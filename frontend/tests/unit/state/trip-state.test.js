/**
 * Unit tests for Trip State Management
 * Tests singleton state from src/state/trip-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

vi.mock('../../../src/services/realtime-updates.js', () => ({
  realtimeManager: {},
}));

let tripState;
let apiClient;

describe('Trip State', () => {
  beforeEach(async () => {
    vi.resetModules();

    vi.mock('../../../src/utils/api-client.js', () => ({
      apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        upload: vi.fn(),
      },
    }));

    vi.mock('../../../src/services/realtime-updates.js', () => ({
      realtimeManager: {},
    }));

    const tripModule = await import('../../../src/state/trip-state.js');
    tripState = tripModule.tripState;

    const apiModule = await import('../../../src/utils/api-client.js');
    apiClient = apiModule.apiClient;
  });

  // ─── loadTrips ────────────────────────────────────────────
  describe('loadTrips', () => {
    it('should load trips from API', async () => {
      const mockTrips = [
        { id: 't1', name: 'Paris Trip' },
        { id: 't2', name: 'Rome Trip' },
      ];
      apiClient.get.mockResolvedValue(mockTrips);

      const result = await tripState.loadTrips();

      expect(apiClient.get).toHaveBeenCalledWith('/trips');
      expect(result).toEqual(mockTrips);
    });

    it('should handle response wrapped in trips property', async () => {
      apiClient.get.mockResolvedValue({
        trips: [{ id: 't1', name: 'Test' }],
      });

      const result = await tripState.loadTrips();
      expect(result).toEqual([{ id: 't1', name: 'Test' }]);
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1' }]);
      const listener = vi.fn();
      tripState.subscribe(listener);

      await tripState.loadTrips();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          trips: [{ id: 't1' }],
        }),
      );
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(tripState.loadTrips()).rejects.toThrow('Network error');

      console.error.mockRestore();
    });
  });

  // ─── loadTrip ─────────────────────────────────────────────
  describe('loadTrip', () => {
    it('should load a single trip', async () => {
      const mockTrip = { id: 't1', name: 'Paris Trip' };
      apiClient.get.mockResolvedValue(mockTrip);

      const result = await tripState.loadTrip('t1');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/t1');
      expect(result).toEqual(mockTrip);
    });

    it('should set current trip', async () => {
      const mockTrip = { id: 't1', name: 'Paris' };
      apiClient.get.mockResolvedValue(mockTrip);

      await tripState.loadTrip('t1');

      expect(tripState.getCurrentTrip()).toEqual(mockTrip);
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue({ id: 't1' });
      const listener = vi.fn();
      tripState.subscribe(listener);

      await tripState.loadTrip('t1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(tripState.loadTrip('bad-id')).rejects.toThrow('Not found');

      console.error.mockRestore();
    });
  });

  // ─── createTrip ───────────────────────────────────────────
  describe('createTrip', () => {
    it('should create a trip', async () => {
      const newTrip = { id: 't1', name: 'New Trip' };
      apiClient.post.mockResolvedValue(newTrip);

      const result = await tripState.createTrip({ name: 'New Trip' });

      expect(apiClient.post).toHaveBeenCalledWith('/trips', { name: 'New Trip' });
      expect(result).toEqual(newTrip);
    });

    it('should add trip to trips list', async () => {
      apiClient.post.mockResolvedValue({ id: 't1', name: 'New Trip' });

      await tripState.createTrip({ name: 'New Trip' });

      expect(tripState.getTrips()).toHaveLength(1);
      expect(tripState.getTrips()[0].id).toBe('t1');
    });

    it('should notify listeners', async () => {
      apiClient.post.mockResolvedValue({ id: 't1' });
      const listener = vi.fn();
      tripState.subscribe(listener);

      await tripState.createTrip({ name: 'Test' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Validation error'));

      await expect(tripState.createTrip({ name: '' })).rejects.toThrow('Validation error');

      console.error.mockRestore();
    });
  });

  // ─── updateTrip ───────────────────────────────────────────
  describe('updateTrip', () => {
    it('should update a trip', async () => {
      // Preload trips
      apiClient.get.mockResolvedValue([{ id: 't1', name: 'Old' }]);
      await tripState.loadTrips();

      const updated = { id: 't1', name: 'Updated' };
      apiClient.patch.mockResolvedValue(updated);

      const result = await tripState.updateTrip('t1', { name: 'Updated' });

      expect(apiClient.patch).toHaveBeenCalledWith('/trips/t1', { name: 'Updated' });
      expect(result).toEqual(updated);
    });

    it('should update trip in trips list', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1', name: 'Old' }]);
      await tripState.loadTrips();

      apiClient.patch.mockResolvedValue({ id: 't1', name: 'Updated' });
      await tripState.updateTrip('t1', { name: 'Updated' });

      expect(tripState.getTrips()[0].name).toBe('Updated');
    });

    it('should update current trip if it matches', async () => {
      apiClient.get.mockResolvedValue({ id: 't1', name: 'Old' });
      await tripState.loadTrip('t1');

      // Also preload into trips list
      tripState.trips = [{ id: 't1', name: 'Old' }];

      apiClient.patch.mockResolvedValue({ id: 't1', name: 'Updated' });
      await tripState.updateTrip('t1', { name: 'Updated' });

      expect(tripState.getCurrentTrip().name).toBe('Updated');
    });

    it('should not update current trip if different trip', async () => {
      apiClient.get.mockResolvedValue({ id: 't1', name: 'Current' });
      await tripState.loadTrip('t1');

      apiClient.patch.mockResolvedValue({ id: 't2', name: 'Other Updated' });
      await tripState.updateTrip('t2', { name: 'Other Updated' });

      expect(tripState.getCurrentTrip().name).toBe('Current');
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.patch.mockRejectedValue(new Error('Update failed'));

      await expect(tripState.updateTrip('t1', {})).rejects.toThrow('Update failed');

      console.error.mockRestore();
    });
  });

  // ─── deleteTrip ───────────────────────────────────────────
  describe('deleteTrip', () => {
    it('should delete a trip', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      await tripState.loadTrips();

      apiClient.delete.mockResolvedValue();

      await tripState.deleteTrip('t1');

      expect(apiClient.delete).toHaveBeenCalledWith('/trips/t1');
      expect(tripState.getTrips()).toHaveLength(1);
      expect(tripState.getTrips()[0].id).toBe('t2');
    });

    it('should clear current trip if deleted', async () => {
      apiClient.get.mockResolvedValueOnce([{ id: 't1' }]);
      await tripState.loadTrips();

      apiClient.get.mockResolvedValueOnce({ id: 't1', name: 'Trip' });
      await tripState.loadTrip('t1');

      apiClient.delete.mockResolvedValue();
      await tripState.deleteTrip('t1');

      expect(tripState.getCurrentTrip()).toBeNull();
      expect(tripState.getCurrentActivities()).toEqual([]);
    });

    it('should not clear current trip if different trip deleted', async () => {
      apiClient.get.mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }]);
      await tripState.loadTrips();

      apiClient.get.mockResolvedValueOnce({ id: 't1', name: 'Current' });
      await tripState.loadTrip('t1');

      apiClient.delete.mockResolvedValue();
      await tripState.deleteTrip('t2');

      expect(tripState.getCurrentTrip()).not.toBeNull();
      expect(tripState.getCurrentTrip().id).toBe('t1');
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1' }]);
      await tripState.loadTrips();

      const listener = vi.fn();
      tripState.subscribe(listener);
      listener.mockClear();

      apiClient.delete.mockResolvedValue();
      await tripState.deleteTrip('t1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(tripState.deleteTrip('t1')).rejects.toThrow('Delete failed');

      console.error.mockRestore();
    });
  });

  // ─── uploadCoverImage ─────────────────────────────────────
  describe('uploadCoverImage', () => {
    it('should upload a cover image', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1', coverImageUrl: null }]);
      await tripState.loadTrips();

      const updatedTrip = { id: 't1', coverImageUrl: '/images/cover.jpg' };
      apiClient.upload.mockResolvedValue({ trip: updatedTrip });

      const mockFile = new File(['test'], 'cover.jpg', { type: 'image/jpeg' });
      const result = await tripState.uploadCoverImage('t1', mockFile);

      expect(apiClient.upload).toHaveBeenCalledWith('/trips/t1/cover-image', expect.any(FormData));
      expect(result).toEqual(updatedTrip);
    });

    it('should update trip in trips list', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1', coverImageUrl: null }]);
      await tripState.loadTrips();

      apiClient.upload.mockResolvedValue({
        trip: { id: 't1', coverImageUrl: '/images/cover.jpg' },
      });

      const mockFile = new File(['test'], 'cover.jpg', { type: 'image/jpeg' });
      await tripState.uploadCoverImage('t1', mockFile);

      expect(tripState.getTrips()[0].coverImageUrl).toBe('/images/cover.jpg');
    });

    it('should update current trip if it matches', async () => {
      apiClient.get.mockResolvedValueOnce({ id: 't1', coverImageUrl: null });
      await tripState.loadTrip('t1');
      tripState.trips = [{ id: 't1', coverImageUrl: null }];

      apiClient.upload.mockResolvedValue({
        trip: { id: 't1', coverImageUrl: '/images/cover.jpg' },
      });

      const mockFile = new File(['test'], 'cover.jpg', { type: 'image/jpeg' });
      await tripState.uploadCoverImage('t1', mockFile);

      expect(tripState.getCurrentTrip().coverImageUrl).toBe('/images/cover.jpg');
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.upload.mockRejectedValue(new Error('Upload failed'));

      const mockFile = new File(['test'], 'cover.jpg', { type: 'image/jpeg' });
      await expect(tripState.uploadCoverImage('t1', mockFile)).rejects.toThrow('Upload failed');

      console.error.mockRestore();
    });
  });

  // ─── deleteCoverImage ─────────────────────────────────────
  describe('deleteCoverImage', () => {
    it('should delete a cover image', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1', coverImageUrl: '/images/cover.jpg' }]);
      await tripState.loadTrips();

      const updatedTrip = { id: 't1', coverImageUrl: null };
      apiClient.delete.mockResolvedValue({ trip: updatedTrip });

      const result = await tripState.deleteCoverImage('t1');

      expect(apiClient.delete).toHaveBeenCalledWith('/trips/t1/cover-image');
      expect(result).toEqual(updatedTrip);
    });

    it('should update trip in list', async () => {
      apiClient.get.mockResolvedValue([{ id: 't1', coverImageUrl: '/images/cover.jpg' }]);
      await tripState.loadTrips();

      apiClient.delete.mockResolvedValue({
        trip: { id: 't1', coverImageUrl: null },
      });

      await tripState.deleteCoverImage('t1');

      expect(tripState.getTrips()[0].coverImageUrl).toBeNull();
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(tripState.deleteCoverImage('t1')).rejects.toThrow('Delete failed');

      console.error.mockRestore();
    });
  });

  // ─── loadActivities ───────────────────────────────────────
  describe('loadActivities', () => {
    it('should load activities for a trip', async () => {
      const mockActivities = [
        { id: 'a1', title: 'Visit Eiffel Tower' },
        { id: 'a2', title: 'Louvre Museum' },
      ];
      apiClient.get.mockResolvedValue(mockActivities);

      const result = await tripState.loadActivities('t1');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/t1/activities');
      expect(result).toEqual(mockActivities);
    });

    it('should handle non-array response', async () => {
      apiClient.get.mockResolvedValue('not an array');

      const result = await tripState.loadActivities('t1');
      expect(result).toEqual([]);
    });

    it('should set current activities', async () => {
      apiClient.get.mockResolvedValue([{ id: 'a1' }]);
      await tripState.loadActivities('t1');

      expect(tripState.getCurrentActivities()).toEqual([{ id: 'a1' }]);
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 'a1' }]);
      const listener = vi.fn();
      tripState.subscribe(listener);

      await tripState.loadActivities('t1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ currentActivities: [{ id: 'a1' }] }),
      );
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Load failed'));

      await expect(tripState.loadActivities('t1')).rejects.toThrow('Load failed');

      console.error.mockRestore();
    });
  });

  // ─── createActivity ───────────────────────────────────────
  describe('createActivity', () => {
    it('should create an activity', async () => {
      const newActivity = { id: 'a1', title: 'New Activity' };
      apiClient.post.mockResolvedValue(newActivity);

      const result = await tripState.createActivity('t1', { title: 'New Activity' });

      expect(apiClient.post).toHaveBeenCalledWith('/trips/t1/activities', {
        title: 'New Activity',
      });
      expect(result).toEqual(newActivity);
    });

    it('should add activity to current activities', async () => {
      apiClient.post.mockResolvedValue({ id: 'a1', title: 'New' });
      await tripState.createActivity('t1', { title: 'New' });

      expect(tripState.getCurrentActivities()).toHaveLength(1);
    });

    it('should notify listeners', async () => {
      apiClient.post.mockResolvedValue({ id: 'a1' });
      const listener = vi.fn();
      tripState.subscribe(listener);

      await tripState.createActivity('t1', { title: 'Test' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Create failed'));

      await expect(tripState.createActivity('t1', {})).rejects.toThrow('Create failed');

      console.error.mockRestore();
    });
  });

  // ─── updateActivity ───────────────────────────────────────
  describe('updateActivity', () => {
    it('should update an activity', async () => {
      // Preload activities
      apiClient.get.mockResolvedValue([{ id: 'a1', title: 'Old' }]);
      await tripState.loadActivities('t1');

      const updated = { id: 'a1', title: 'Updated' };
      apiClient.patch.mockResolvedValue(updated);

      const result = await tripState.updateActivity('a1', { title: 'Updated' });

      expect(apiClient.patch).toHaveBeenCalledWith('/activities/a1', { title: 'Updated' });
      expect(result).toEqual(updated);
    });

    it('should update activity in current activities list', async () => {
      apiClient.get.mockResolvedValue([{ id: 'a1', title: 'Old' }]);
      await tripState.loadActivities('t1');

      apiClient.patch.mockResolvedValue({ id: 'a1', title: 'Updated' });
      await tripState.updateActivity('a1', { title: 'Updated' });

      expect(tripState.getCurrentActivities()[0].title).toBe('Updated');
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.patch.mockRejectedValue(new Error('Update failed'));

      await expect(tripState.updateActivity('a1', {})).rejects.toThrow('Update failed');

      console.error.mockRestore();
    });
  });

  // ─── deleteActivity ───────────────────────────────────────
  describe('deleteActivity', () => {
    it('should delete an activity', async () => {
      apiClient.get.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      await tripState.loadActivities('t1');

      apiClient.delete.mockResolvedValue();
      await tripState.deleteActivity('a1');

      expect(apiClient.delete).toHaveBeenCalledWith('/activities/a1');
      expect(tripState.getCurrentActivities()).toHaveLength(1);
      expect(tripState.getCurrentActivities()[0].id).toBe('a2');
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 'a1' }]);
      await tripState.loadActivities('t1');

      const listener = vi.fn();
      tripState.subscribe(listener);
      listener.mockClear();

      apiClient.delete.mockResolvedValue();
      await tripState.deleteActivity('a1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(tripState.deleteActivity('a1')).rejects.toThrow('Delete failed');

      console.error.mockRestore();
    });
  });

  // ─── reorderActivities ────────────────────────────────────
  describe('reorderActivities', () => {
    it('should reorder activities', async () => {
      apiClient.get.mockResolvedValue([
        { id: 'a1', orderIndex: 0 },
        { id: 'a2', orderIndex: 1 },
      ]);
      await tripState.loadActivities('t1');

      apiClient.post.mockResolvedValue();

      const order = [
        { id: 'a2', orderIndex: 0 },
        { id: 'a1', orderIndex: 1 },
      ];
      await tripState.reorderActivities('t1', order);

      expect(apiClient.post).toHaveBeenCalledWith('/trips/t1/activities/reorder', {
        order,
      });
    });

    it('should update order indices in current activities', async () => {
      apiClient.get.mockResolvedValue([
        { id: 'a1', orderIndex: 0 },
        { id: 'a2', orderIndex: 1 },
      ]);
      await tripState.loadActivities('t1');

      apiClient.post.mockResolvedValue();

      await tripState.reorderActivities('t1', [
        { id: 'a2', orderIndex: 0 },
        { id: 'a1', orderIndex: 1 },
      ]);

      const activities = tripState.getCurrentActivities();
      expect(activities.find((a) => a.id === 'a1').orderIndex).toBe(1);
      expect(activities.find((a) => a.id === 'a2').orderIndex).toBe(0);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Reorder failed'));

      await expect(tripState.reorderActivities('t1', [])).rejects.toThrow('Reorder failed');

      console.error.mockRestore();
    });
  });

  // ─── reorderReservations ──────────────────────────────────
  describe('reorderReservations', () => {
    it('should reorder reservations using activities endpoint', async () => {
      apiClient.get.mockResolvedValue([
        { id: 'r1', orderIndex: 0, metadata: { isReservation: true } },
        { id: 'r2', orderIndex: 1, metadata: { isReservation: true } },
      ]);
      await tripState.loadActivities('t1');

      apiClient.post.mockResolvedValue();

      const order = [
        { id: 'r2', orderIndex: 0 },
        { id: 'r1', orderIndex: 1 },
      ];
      await tripState.reorderReservations('t1', order);

      expect(apiClient.post).toHaveBeenCalledWith('/trips/t1/activities/reorder', {
        order,
      });
    });

    it('should update order indices', async () => {
      apiClient.get.mockResolvedValue([
        { id: 'r1', orderIndex: 0 },
        { id: 'r2', orderIndex: 1 },
      ]);
      await tripState.loadActivities('t1');

      apiClient.post.mockResolvedValue();

      await tripState.reorderReservations('t1', [
        { id: 'r2', orderIndex: 0 },
        { id: 'r1', orderIndex: 1 },
      ]);

      const activities = tripState.getCurrentActivities();
      expect(activities.find((a) => a.id === 'r1').orderIndex).toBe(1);
      expect(activities.find((a) => a.id === 'r2').orderIndex).toBe(0);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Reorder failed'));

      await expect(tripState.reorderReservations('t1', [])).rejects.toThrow('Reorder failed');

      console.error.mockRestore();
    });
  });

  // ─── getTrips / getCurrentTrip / getCurrentActivities ─────
  describe('getTrips / getCurrentTrip / getCurrentActivities', () => {
    it('should return empty array for trips initially', () => {
      expect(tripState.getTrips()).toEqual([]);
    });

    it('should return null for current trip initially', () => {
      expect(tripState.getCurrentTrip()).toBeNull();
    });

    it('should return empty array for current activities initially', () => {
      expect(tripState.getCurrentActivities()).toEqual([]);
    });
  });

  // ─── subscribe ────────────────────────────────────────────
  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = tripState.subscribe(listener);

      tripState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      tripState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tripState.subscribe(listener1);
      tripState.subscribe(listener2);

      tripState.notifyListeners();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should pass state object to listeners', () => {
      const listener = vi.fn();
      tripState.subscribe(listener);

      tripState.notifyListeners();

      expect(listener).toHaveBeenCalledWith({
        trips: [],
        currentTrip: null,
        currentActivities: [],
      });
    });

    it('should not crash if a listener throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const normalListener = vi.fn();

      tripState.subscribe(errorListener);
      tripState.subscribe(normalListener);

      expect(() => tripState.notifyListeners()).not.toThrow();
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });
  });

  // ─── clear ────────────────────────────────────────────────
  describe('clear', () => {
    it('should clear all state', async () => {
      apiClient.get.mockResolvedValueOnce([{ id: 't1' }]);
      await tripState.loadTrips();

      apiClient.get.mockResolvedValueOnce({ id: 't1', name: 'Trip' });
      await tripState.loadTrip('t1');

      apiClient.get.mockResolvedValueOnce([{ id: 'a1' }]);
      await tripState.loadActivities('t1');

      tripState.clear();

      expect(tripState.getTrips()).toEqual([]);
      expect(tripState.getCurrentTrip()).toBeNull();
      expect(tripState.getCurrentActivities()).toEqual([]);
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      tripState.subscribe(listener);

      tripState.clear();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        trips: [],
        currentTrip: null,
        currentActivities: [],
      });
    });
  });
});
