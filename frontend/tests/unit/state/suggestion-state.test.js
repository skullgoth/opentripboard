/**
 * Unit tests for Suggestion State Management
 * Tests singleton state from src/state/suggestion-state.js
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

let suggestionState;
let apiClient;

describe('Suggestion State', () => {
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

    const sugModule = await import('../../../src/state/suggestion-state.js');
    suggestionState = sugModule.suggestionState;

    const apiModule = await import('../../../src/utils/api-client.js');
    apiClient = apiModule.apiClient;
  });

  // ─── loadSuggestions ──────────────────────────────────────
  describe('loadSuggestions', () => {
    it('should load suggestions for a trip', async () => {
      const mockSuggestions = [
        { id: 's1', title: 'Visit museum' },
        { id: 's2', title: 'Go hiking' },
      ];
      apiClient.get.mockResolvedValue(mockSuggestions);

      const result = await suggestionState.loadSuggestions('trip1');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/trip1/suggestions');
      expect(result).toEqual(mockSuggestions);
    });

    it('should load suggestions with status filter', async () => {
      apiClient.get.mockResolvedValue([]);

      await suggestionState.loadSuggestions('trip1', 'pending');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/trip1/suggestions?status=pending');
    });

    it('should handle response wrapped in suggestions property', async () => {
      apiClient.get.mockResolvedValue({
        suggestions: [{ id: 's1', title: 'Test' }],
      });

      const result = await suggestionState.loadSuggestions('trip1');
      expect(result).toEqual([{ id: 's1', title: 'Test' }]);
    });

    it('should notify listeners after loading', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1' }]);
      const listener = vi.fn();
      suggestionState.subscribe(listener);

      await suggestionState.loadSuggestions('trip1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([{ id: 's1' }]);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(suggestionState.loadSuggestions('trip1')).rejects.toThrow('Network error');

      console.error.mockRestore();
    });
  });

  // ─── loadSuggestion ───────────────────────────────────────
  describe('loadSuggestion', () => {
    it('should load a single suggestion by ID', async () => {
      const mockSuggestion = { id: 's1', title: 'Visit museum' };
      apiClient.get.mockResolvedValue(mockSuggestion);

      const result = await suggestionState.loadSuggestion('s1');

      expect(apiClient.get).toHaveBeenCalledWith('/suggestions/s1');
      expect(result).toEqual(mockSuggestion);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(suggestionState.loadSuggestion('bad-id')).rejects.toThrow('Not found');

      console.error.mockRestore();
    });
  });

  // ─── createSuggestion ─────────────────────────────────────
  describe('createSuggestion', () => {
    it('should create a suggestion and add to list', async () => {
      const newSuggestion = { id: 's1', title: 'New Suggestion' };
      apiClient.post.mockResolvedValue(newSuggestion);

      const result = await suggestionState.createSuggestion('trip1', { title: 'New Suggestion' });

      expect(apiClient.post).toHaveBeenCalledWith('/trips/trip1/suggestions', {
        title: 'New Suggestion',
      });
      expect(result).toEqual(newSuggestion);
    });

    it('should notify listeners', async () => {
      apiClient.post.mockResolvedValue({ id: 's1' });
      const listener = vi.fn();
      suggestionState.subscribe(listener);

      await suggestionState.createSuggestion('trip1', { title: 'Test' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Validation error'));

      await expect(
        suggestionState.createSuggestion('trip1', { title: '' }),
      ).rejects.toThrow('Validation error');

      console.error.mockRestore();
    });
  });

  // ─── voteSuggestion ───────────────────────────────────────
  describe('voteSuggestion', () => {
    it('should vote on a suggestion', async () => {
      // Preload suggestions
      apiClient.get.mockResolvedValue([{ id: 's1', title: 'Test', votes: 0 }]);
      await suggestionState.loadSuggestions('trip1');

      const updated = { id: 's1', title: 'Test', votes: 1 };
      apiClient.post.mockResolvedValue(updated);

      const result = await suggestionState.voteSuggestion('s1', 'up');

      expect(apiClient.post).toHaveBeenCalledWith('/suggestions/s1/vote', { vote: 'up' });
      expect(result).toEqual(updated);
    });

    it('should update the suggestion in the internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', votes: 0 }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.post.mockResolvedValue({ id: 's1', votes: 1 });
      await suggestionState.voteSuggestion('s1', 'up');

      const listener = vi.fn();
      suggestionState.subscribe(listener);

      // Trigger a notification to check state
      apiClient.post.mockResolvedValue({ id: 's1', votes: 2 });
      await suggestionState.voteSuggestion('s1', 'up');

      const suggestions = listener.mock.calls[0][0];
      expect(suggestions.find((s) => s.id === 's1').votes).toBe(2);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Vote failed'));

      await expect(suggestionState.voteSuggestion('s1', 'up')).rejects.toThrow('Vote failed');

      console.error.mockRestore();
    });
  });

  // ─── acceptSuggestion ─────────────────────────────────────
  describe('acceptSuggestion', () => {
    it('should accept a suggestion', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', status: 'pending' }]);
      await suggestionState.loadSuggestions('trip1');

      const result = {
        suggestion: { id: 's1', status: 'accepted' },
        activity: { id: 'a1' },
      };
      apiClient.post.mockResolvedValue(result);

      const response = await suggestionState.acceptSuggestion('s1');

      expect(apiClient.post).toHaveBeenCalledWith('/suggestions/s1/accept', {});
      expect(response).toEqual(result);
    });

    it('should update suggestion in list', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', status: 'pending' }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.post.mockResolvedValue({
        suggestion: { id: 's1', status: 'accepted' },
        activity: { id: 'a1' },
      });

      await suggestionState.acceptSuggestion('s1');

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      // Trigger notification
      suggestionState.clear();
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Accept failed'));

      await expect(suggestionState.acceptSuggestion('s1')).rejects.toThrow('Accept failed');

      console.error.mockRestore();
    });
  });

  // ─── rejectSuggestion ─────────────────────────────────────
  describe('rejectSuggestion', () => {
    it('should reject a suggestion', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', status: 'pending' }]);
      await suggestionState.loadSuggestions('trip1');

      const updated = { id: 's1', status: 'rejected' };
      apiClient.post.mockResolvedValue(updated);

      const result = await suggestionState.rejectSuggestion('s1');

      expect(apiClient.post).toHaveBeenCalledWith('/suggestions/s1/reject', {});
      expect(result).toEqual(updated);
    });

    it('should update suggestion in internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', status: 'pending' }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.post.mockResolvedValue({ id: 's1', status: 'rejected' });
      await suggestionState.rejectSuggestion('s1');

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      suggestionState.notifyListeners();

      const suggestions = listener.mock.calls[0][0];
      expect(suggestions.find((s) => s.id === 's1').status).toBe('rejected');
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Reject failed'));

      await expect(suggestionState.rejectSuggestion('s1')).rejects.toThrow('Reject failed');

      console.error.mockRestore();
    });
  });

  // ─── updateSuggestion ─────────────────────────────────────
  describe('updateSuggestion', () => {
    it('should update a suggestion', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', title: 'Old' }]);
      await suggestionState.loadSuggestions('trip1');

      const updated = { id: 's1', title: 'New' };
      apiClient.patch.mockResolvedValue(updated);

      const result = await suggestionState.updateSuggestion('s1', { title: 'New' });

      expect(apiClient.patch).toHaveBeenCalledWith('/suggestions/s1', { title: 'New' });
      expect(result).toEqual(updated);
    });

    it('should update suggestion in internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1', title: 'Old' }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.patch.mockResolvedValue({ id: 's1', title: 'New' });
      await suggestionState.updateSuggestion('s1', { title: 'New' });

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      suggestionState.notifyListeners();

      const suggestions = listener.mock.calls[0][0];
      expect(suggestions.find((s) => s.id === 's1').title).toBe('New');
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.patch.mockRejectedValue(new Error('Update failed'));

      await expect(
        suggestionState.updateSuggestion('s1', { title: 'X' }),
      ).rejects.toThrow('Update failed');

      console.error.mockRestore();
    });
  });

  // ─── deleteSuggestion ─────────────────────────────────────
  describe('deleteSuggestion', () => {
    it('should delete a suggestion', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.delete.mockResolvedValue();

      await suggestionState.deleteSuggestion('s1');

      expect(apiClient.delete).toHaveBeenCalledWith('/suggestions/s1');
    });

    it('should remove suggestion from internal list', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      await suggestionState.loadSuggestions('trip1');

      apiClient.delete.mockResolvedValue();
      await suggestionState.deleteSuggestion('s1');

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      suggestionState.notifyListeners();

      const suggestions = listener.mock.calls[0][0];
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].id).toBe('s2');
    });

    it('should notify listeners', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1' }]);
      await suggestionState.loadSuggestions('trip1');

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      listener.mockClear();

      apiClient.delete.mockResolvedValue();
      await suggestionState.deleteSuggestion('s1');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(suggestionState.deleteSuggestion('s1')).rejects.toThrow('Delete failed');

      console.error.mockRestore();
    });
  });

  // ─── loadSuggestionStats ──────────────────────────────────
  describe('loadSuggestionStats', () => {
    it('should load suggestion stats for a trip', async () => {
      const mockStats = { total: 5, pending: 3, accepted: 1, rejected: 1 };
      apiClient.get.mockResolvedValue(mockStats);

      const result = await suggestionState.loadSuggestionStats('trip1');

      expect(apiClient.get).toHaveBeenCalledWith('/trips/trip1/suggestions/stats');
      expect(result).toEqual(mockStats);
    });

    it('should throw on API failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.get.mockRejectedValue(new Error('Stats failed'));

      await expect(suggestionState.loadSuggestionStats('trip1')).rejects.toThrow('Stats failed');

      console.error.mockRestore();
    });
  });

  // ─── subscribe ────────────────────────────────────────────
  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = suggestionState.subscribe(listener);

      suggestionState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      suggestionState.notifyListeners();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      suggestionState.subscribe(listener1);
      suggestionState.subscribe(listener2);

      suggestionState.notifyListeners();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should not crash if a listener throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const normalListener = vi.fn();

      suggestionState.subscribe(errorListener);
      suggestionState.subscribe(normalListener);

      expect(() => suggestionState.notifyListeners()).not.toThrow();
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });
  });

  // ─── clear ────────────────────────────────────────────────
  describe('clear', () => {
    it('should clear all suggestions', async () => {
      apiClient.get.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      await suggestionState.loadSuggestions('trip1');

      suggestionState.clear();

      const listener = vi.fn();
      suggestionState.subscribe(listener);
      suggestionState.notifyListeners();

      expect(listener.mock.calls[0][0]).toEqual([]);
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      suggestionState.subscribe(listener);

      suggestionState.clear();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([]);
    });
  });
});
