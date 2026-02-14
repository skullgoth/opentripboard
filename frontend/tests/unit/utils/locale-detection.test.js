import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  getBrowserLanguage,
  getBrowserLocale,
  detectDefaultPreferences,
  getDefaultPreferences,
} from '../../../src/utils/locale-detection.js';

describe('Locale Detection', () => {
  const originalNavigator = globalThis.navigator;

  function mockNavigatorLanguage(lang) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { language: lang },
      configurable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include en, fr, es', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('fr');
      expect(SUPPORTED_LANGUAGES).toContain('es');
    });
  });

  describe('getBrowserLanguage', () => {
    it('should return en for en-US', () => {
      mockNavigatorLanguage('en-US');
      expect(getBrowserLanguage()).toBe('en');
    });

    it('should return fr for fr-FR', () => {
      mockNavigatorLanguage('fr-FR');
      expect(getBrowserLanguage()).toBe('fr');
    });

    it('should return es for es-ES', () => {
      mockNavigatorLanguage('es-ES');
      expect(getBrowserLanguage()).toBe('es');
    });

    it('should return en for unsupported language', () => {
      mockNavigatorLanguage('de-DE');
      expect(getBrowserLanguage()).toBe('en');
    });
  });

  describe('getBrowserLocale', () => {
    it('should return navigator.language', () => {
      mockNavigatorLanguage('fr-FR');
      expect(getBrowserLocale()).toBe('fr-FR');
    });
  });

  describe('detectDefaultPreferences', () => {
    it('should detect US preferences', () => {
      mockNavigatorLanguage('en-US');
      const prefs = detectDefaultPreferences();
      expect(prefs.language).toBe('en');
      expect(prefs.dateFormat).toBe('mdy');
      expect(prefs.timeFormat).toBe('12h');
      expect(prefs.distanceFormat).toBe('mi');
    });

    it('should detect French preferences', () => {
      mockNavigatorLanguage('fr-FR');
      const prefs = detectDefaultPreferences();
      expect(prefs.language).toBe('fr');
      expect(prefs.dateFormat).toBe('dmy');
      expect(prefs.timeFormat).toBe('24h');
      expect(prefs.distanceFormat).toBe('km');
    });

    it('should detect UK preferences', () => {
      mockNavigatorLanguage('en-GB');
      const prefs = detectDefaultPreferences();
      expect(prefs.language).toBe('en');
      expect(prefs.dateFormat).toBe('dmy');
      expect(prefs.timeFormat).toBe('12h');
      expect(prefs.distanceFormat).toBe('mi');
    });

    it('should use km for non-US/UK regions', () => {
      mockNavigatorLanguage('es-ES');
      const prefs = detectDefaultPreferences();
      expect(prefs.distanceFormat).toBe('km');
    });
  });

  describe('getDefaultPreferences', () => {
    it('should return valid preference object', () => {
      mockNavigatorLanguage('en-US');
      const prefs = getDefaultPreferences();
      expect(prefs).toHaveProperty('language');
      expect(prefs).toHaveProperty('dateFormat');
      expect(prefs).toHaveProperty('timeFormat');
      expect(prefs).toHaveProperty('distanceFormat');
    });
  });
});
