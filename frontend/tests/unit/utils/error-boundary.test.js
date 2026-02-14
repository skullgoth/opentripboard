import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/error-tracking.js', () => ({
  captureError: vi.fn(),
  initErrorTracking: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../src/utils/i18n.js', () => ({
  t: vi.fn((key) => key),
}));

import {
  onError,
  getLastError,
  clearLastError,
  withErrorBoundary,
  tryCatch,
} from '../../../src/utils/error-boundary.js';

describe('Error Boundary', () => {
  beforeEach(() => {
    clearLastError();
  });

  describe('tryCatch', () => {
    it('should return result of successful function', () => {
      const result = tryCatch(() => 42);
      expect(result).toBe(42);
    });

    it('should return fallback on error', () => {
      const result = tryCatch(() => {
        throw new Error('fail');
      }, 'default');
      expect(result).toBe('default');
    });

    it('should return null as default fallback', () => {
      const result = tryCatch(() => {
        throw new Error('fail');
      });
      expect(result).toBeNull();
    });
  });

  describe('withErrorBoundary', () => {
    it('should return a function', () => {
      const fn = vi.fn();
      const wrapped = withErrorBoundary(fn);
      expect(typeof wrapped).toBe('function');
    });

    it('should call the original function with args', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const wrapped = withErrorBoundary(fn);
      const result = await wrapped('a', 'b');
      expect(fn).toHaveBeenCalledWith('a', 'b');
      expect(result).toBe('ok');
    });

    it('should catch errors without rethrowing by default', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const wrapped = withErrorBoundary(fn, { showUI: false });
      const result = await wrapped();
      expect(result).toBeUndefined();
    });

    it('should rethrow errors when configured', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const wrapped = withErrorBoundary(fn, { rethrow: true, showUI: false });
      await expect(wrapped()).rejects.toThrow('fail');
    });
  });

  describe('onError / getLastError / clearLastError', () => {
    it('should return null when no error', () => {
      expect(getLastError()).toBeNull();
    });

    it('clearLastError should clear the error', () => {
      clearLastError();
      expect(getLastError()).toBeNull();
    });

    it('onError should accept a callback', () => {
      const callback = vi.fn();
      expect(() => onError(callback)).not.toThrow();
    });
  });
});
