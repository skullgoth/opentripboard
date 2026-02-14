/**
 * Unit tests for Trip Buddy State Management
 * Tests singleton state from src/state/trip-buddy-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

let tripBuddyState;
let apiClient;

describe('Trip Buddy State', () => {
  beforeEach(async () => {
    vi.resetModules();

    vi.mock('../../../src/utils/api-client.js', () => ({
      apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
    }));

    const buddyModule = await import('../../../src/state/trip-buddy-state.js');
    tripBuddyState = buddyModule.tripBuddyState;

    const apiModule = await import('../../../src/utils/api-client.js');
    apiClient = apiModule.apiClient;
  });

  // ─── loadTripBuddies ──────────────────────────────────────
  describe('loadTripBuddies', () => {
    it('should load trip buddies for a trip', async () => {
      const mockBuddies = [
        { id: 'b1', email: 'buddy1@test.com', role: 'editor' },
        { id: 'b2', email: 'buddy2@test.com', role: 'viewer' },
      ];
      apiClient.get.mockResolvedValue(mockBuddies);

      const result = await tripBuddyState.loadTripBuddies('trip1');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/trip1/trip-buddies');
      expect(result).toEqual(mockBuddies);
    });

    it('should handle response wrapped in tripBuddies property', async () => {
      apiClient.get.mockResolvedValue({
        tripBuddies: [{ id: 'b1', email: 'buddy@test.com' }],
      });

      const result = await tripBuddyState.loadTripBuddies('trip1');
      expect(result).toEqual([{ id: 'b1', email: 'buddy@test.com' }]);
    });

    it('should notify listeners after loading', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1' }]);
      const listener = vi.fn();
      tripBuddyState.subscribe(listener);

      await tripBuddyState.loadTripBuddies('trip1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([{ id: 'b1' }]);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(tripBuddyState.loadTripBuddies('trip1')).rejects.toThrow('Network error');

      console.error.mockRestore();
    });
  });

  // ─── inviteTripBuddy ──────────────────────────────────────
  describe('inviteTripBuddy', () => {
    it('should invite a trip buddy', async () => {
      const newBuddy = { id: 'b1', email: 'buddy@test.com', role: 'editor' };
      apiClient.post.mockResolvedValue(newBuddy);

      const result = await tripBuddyState.inviteTripBuddy('trip1', {
        email: 'buddy@test.com',
        role: 'editor',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/trips/trip1/trip-buddies', {
        email: 'buddy@test.com',
        role: 'editor',
      });
      expect(result).toEqual(newBuddy);
    });

    it('should add buddy to internal list', async () => {
      apiClient.post.mockResolvedValue({ id: 'b1', email: 'buddy@test.com' });

      await tripBuddyState.inviteTripBuddy('trip1', { email: 'buddy@test.com' });

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      tripBuddyState.notifyListeners();

      expect(listener.mock.calls[0][0]).toHaveLength(1);
      expect(listener.mock.calls[0][0][0].id).toBe('b1');
    });

    it('should notify listeners', async () => {
      apiClient.post.mockResolvedValue({ id: 'b1' });
      const listener = vi.fn();
      tripBuddyState.subscribe(listener);

      await tripBuddyState.inviteTripBuddy('trip1', { email: 'test@test.com' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Already invited'));

      await expect(
        tripBuddyState.inviteTripBuddy('trip1', { email: 'test@test.com' }),
      ).rejects.toThrow('Already invited');

      console.error.mockRestore();
    });
  });

  // ─── updateTripBuddyRole ──────────────────────────────────
  describe('updateTripBuddyRole', () => {
    it('should update trip buddy role', async () => {
      // Preload buddies
      apiClient.get.mockResolvedValue([{ id: 'b1', role: 'viewer' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      const updated = { id: 'b1', role: 'editor' };
      apiClient.patch.mockResolvedValue(updated);

      const result = await tripBuddyState.updateTripBuddyRole('b1', 'editor');

      expect(apiClient.patch).toHaveBeenCalledWith('/trip-buddies/b1', { role: 'editor' });
      expect(result).toEqual(updated);
    });

    it('should update buddy in internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1', role: 'viewer' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      apiClient.patch.mockResolvedValue({ id: 'b1', role: 'editor' });
      await tripBuddyState.updateTripBuddyRole('b1', 'editor');

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      tripBuddyState.notifyListeners();

      const buddies = listener.mock.calls[0][0];
      expect(buddies.find((b) => b.id === 'b1').role).toBe('editor');
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1', role: 'viewer' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      listener.mockClear();

      apiClient.patch.mockResolvedValue({ id: 'b1', role: 'editor' });
      await tripBuddyState.updateTripBuddyRole('b1', 'editor');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.patch.mockRejectedValue(new Error('Forbidden'));

      await expect(tripBuddyState.updateTripBuddyRole('b1', 'editor')).rejects.toThrow(
        'Forbidden',
      );

      console.error.mockRestore();
    });
  });

  // ─── removeTripBuddy ──────────────────────────────────────
  describe('removeTripBuddy', () => {
    it('should remove a trip buddy', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      apiClient.delete.mockResolvedValue();

      await tripBuddyState.removeTripBuddy('b1');

      expect(apiClient.delete).toHaveBeenCalledWith('/trip-buddies/b1');
    });

    it('should remove buddy from internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      apiClient.delete.mockResolvedValue();
      await tripBuddyState.removeTripBuddy('b1');

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      tripBuddyState.notifyListeners();

      const buddies = listener.mock.calls[0][0];
      expect(buddies).toHaveLength(1);
      expect(buddies[0].id).toBe('b2');
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      listener.mockClear();

      apiClient.delete.mockResolvedValue();
      await tripBuddyState.removeTripBuddy('b1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(tripBuddyState.removeTripBuddy('b1')).rejects.toThrow('Delete failed');

      console.error.mockRestore();
    });
  });

  // ─── subscribe ────────────────────────────────────────────
  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = tripBuddyState.subscribe(listener);

      tripBuddyState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      tripBuddyState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      tripBuddyState.subscribe(listener1);
      tripBuddyState.subscribe(listener2);

      tripBuddyState.notifyListeners();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should pass tripBuddies array to listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1', email: 'test@test.com' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      tripBuddyState.notifyListeners();

      expect(listener).toHaveBeenCalledWith([{ id: 'b1', email: 'test@test.com' }]);
    });

    it('should not crash if a listener throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const normalListener = vi.fn();

      tripBuddyState.subscribe(errorListener);
      tripBuddyState.subscribe(normalListener);

      expect(() => tripBuddyState.notifyListeners()).not.toThrow();
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });
  });

  // ─── clear ────────────────────────────────────────────────
  describe('clear', () => {
    it('should clear all trip buddies', async () => {
      apiClient.get.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      await tripBuddyState.loadTripBuddies('trip1');

      tripBuddyState.clear();

      const listener = vi.fn();
      tripBuddyState.subscribe(listener);
      tripBuddyState.notifyListeners();

      expect(listener.mock.calls[0][0]).toEqual([]);
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      tripBuddyState.subscribe(listener);

      tripBuddyState.clear();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([]);
    });
  });
});
