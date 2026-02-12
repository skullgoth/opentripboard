/**
 * Unit tests for Preferences State Management
 * Tests singleton state from src/state/preferences-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock locale-detection to control default preferences
vi.mock('../../../src/utils/locale-detection.js', () => ({
  getDefaultPreferences: () => ({
    language: 'en',
    dateFormat: 'mdy',
    timeFormat: '12h',
    distanceFormat: 'mi',
  }),
}));

import {
  getPreferences,
  setPreferences,
  updatePreferences,
  isPreferencesLoaded,
  subscribeToPreferences,
  resetPreferences,
} from '../../../src/state/preferences-state.js';

describe('Preferences State', () => {
  beforeEach(() => {
    resetPreferences();
  });

  // ─── getPreferences ────────────────────────────────────────
  describe('getPreferences', () => {
    it('should return default preferences initially', () => {
      const prefs = getPreferences();
      expect(prefs.language).toBe('en');
      expect(prefs.dateFormat).toBe('mdy');
      expect(prefs.timeFormat).toBe('12h');
      expect(prefs.distanceFormat).toBe('mi');
    });

    it('should return a copy, not a reference', () => {
      const prefs1 = getPreferences();
      const prefs2 = getPreferences();
      expect(prefs1).toEqual(prefs2);
      expect(prefs1).not.toBe(prefs2);
    });

    it('should not be affected by mutating the returned object', () => {
      const prefs = getPreferences();
      prefs.language = 'fr';
      expect(getPreferences().language).toBe('en');
    });
  });

  // ─── setPreferences ────────────────────────────────────────
  describe('setPreferences', () => {
    it('should replace all preferences', () => {
      setPreferences({
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
      });

      const prefs = getPreferences();
      expect(prefs.language).toBe('fr');
      expect(prefs.dateFormat).toBe('dmy');
      expect(prefs.timeFormat).toBe('24h');
      expect(prefs.distanceFormat).toBe('km');
    });

    it('should mark preferences as loaded', () => {
      expect(isPreferencesLoaded()).toBe(false);
      setPreferences({ language: 'en', dateFormat: 'mdy', timeFormat: '12h', distanceFormat: 'mi' });
      expect(isPreferencesLoaded()).toBe(true);
    });

    it('should store a copy of the input', () => {
      const input = { language: 'es', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' };
      setPreferences(input);
      input.language = 'changed';
      expect(getPreferences().language).toBe('es');
    });
  });

  // ─── updatePreferences ─────────────────────────────────────
  describe('updatePreferences', () => {
    it('should merge updates with existing preferences', () => {
      updatePreferences({ language: 'fr' });
      const prefs = getPreferences();
      expect(prefs.language).toBe('fr');
      expect(prefs.dateFormat).toBe('mdy'); // unchanged
    });

    it('should allow updating multiple fields at once', () => {
      updatePreferences({ language: 'es', timeFormat: '24h' });
      const prefs = getPreferences();
      expect(prefs.language).toBe('es');
      expect(prefs.timeFormat).toBe('24h');
    });
  });

  // ─── isPreferencesLoaded ───────────────────────────────────
  describe('isPreferencesLoaded', () => {
    it('should return false initially', () => {
      expect(isPreferencesLoaded()).toBe(false);
    });

    it('should return true after setPreferences', () => {
      setPreferences({ language: 'en', dateFormat: 'mdy', timeFormat: '12h', distanceFormat: 'mi' });
      expect(isPreferencesLoaded()).toBe(true);
    });

    it('should return false after resetPreferences', () => {
      setPreferences({ language: 'en', dateFormat: 'mdy', timeFormat: '12h', distanceFormat: 'mi' });
      resetPreferences();
      expect(isPreferencesLoaded()).toBe(false);
    });
  });

  // ─── subscribeToPreferences ────────────────────────────────
  describe('subscribeToPreferences', () => {
    it('should notify subscriber on setPreferences', () => {
      const callback = vi.fn();
      subscribeToPreferences(callback);

      setPreferences({ language: 'fr', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'fr' }),
        expect.objectContaining({ language: 'en' }),
      );
    });

    it('should notify subscriber on updatePreferences', () => {
      const callback = vi.fn();
      subscribeToPreferences(callback);

      updatePreferences({ language: 'es' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should notify subscriber on resetPreferences', () => {
      setPreferences({ language: 'fr', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' });

      const callback = vi.fn();
      subscribeToPreferences(callback);

      resetPreferences();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en' }),
        expect.objectContaining({ language: 'fr' }),
      );
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToPreferences(callback);

      unsubscribe();
      setPreferences({ language: 'fr', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      subscribeToPreferences(callback1);
      subscribeToPreferences(callback2);

      updatePreferences({ language: 'fr' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not crash if subscriber throws', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('subscriber error');
      });
      const normalCallback = vi.fn();

      vi.spyOn(console, 'error').mockImplementation(() => {});

      subscribeToPreferences(errorCallback);
      subscribeToPreferences(normalCallback);

      expect(() => updatePreferences({ language: 'fr' })).not.toThrow();
      expect(normalCallback).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });
  });

  // ─── resetPreferences ──────────────────────────────────────
  describe('resetPreferences', () => {
    it('should restore default preferences', () => {
      setPreferences({ language: 'fr', dateFormat: 'dmy', timeFormat: '24h', distanceFormat: 'km' });
      resetPreferences();

      const prefs = getPreferences();
      expect(prefs.language).toBe('en');
      expect(prefs.dateFormat).toBe('mdy');
    });

    it('should set isLoaded back to false', () => {
      setPreferences({ language: 'en', dateFormat: 'mdy', timeFormat: '12h', distanceFormat: 'mi' });
      resetPreferences();
      expect(isPreferencesLoaded()).toBe(false);
    });
  });
});
