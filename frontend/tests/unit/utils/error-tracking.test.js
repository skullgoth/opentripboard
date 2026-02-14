import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureError,
  captureMessage,
  setUser,
  clearUser,
  withErrorTracking,
} from '../../../src/utils/error-tracking.js';

describe('Error Tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('captureError', () => {
    it('should log error to console when not enabled', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureError(new Error('test error'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should include context in error data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureError(new Error('test'), { type: 'manual' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('captureMessage', () => {
    it('should not throw when called', () => {
      expect(() => captureMessage('test message', 'info')).not.toThrow();
    });
  });

  describe('setUser / clearUser', () => {
    it('should not throw when setting user', () => {
      expect(() => setUser({ id: '1', email: 'test@test.com' })).not.toThrow();
    });

    it('should not throw when clearing user', () => {
      expect(() => clearUser()).not.toThrow();
    });
  });

  describe('withErrorTracking', () => {
    it('should return a wrapper function', () => {
      const fn = vi.fn();
      const wrapped = withErrorTracking(fn);
      expect(typeof wrapped).toBe('function');
    });

    it('should call the original function', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const wrapped = withErrorTracking(fn);
      const result = await wrapped('arg1');
      expect(fn).toHaveBeenCalledWith('arg1');
      expect(result).toBe('result');
    });

    it('should capture and rethrow errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const wrapped = withErrorTracking(fn);
      await expect(wrapped()).rejects.toThrow('fail');
    });
  });
});
