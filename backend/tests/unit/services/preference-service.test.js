/**
 * Unit tests for Preference Service
 * Tests preference CRUD, supported languages, locale defaults, and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as preferenceService from '../../../src/services/preference-service.js';
import * as preferenceQueries from '../../../src/db/queries/preferences.js';

vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/preferences.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
    validatePreferences: vi.fn(),
    getDefaultsForLocale: vi.fn(),
  };
});

describe('Preference Service', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreferences', () => {
    it('should return user preferences when they exist', async () => {
      const mockPrefs = {
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
        isDefault: false,
      };
      vi.mocked(preferenceQueries.getUserPreferences).mockResolvedValue(mockPrefs);

      const result = await preferenceService.getPreferences(userId);

      expect(result.language).toBe('fr');
      expect(result.timeFormat).toBe('24h');
    });

    it('should return default preferences when user has none', async () => {
      vi.mocked(preferenceQueries.getUserPreferences).mockResolvedValue(null);

      const result = await preferenceService.getPreferences(userId);

      expect(result.language).toBe('en');
      expect(result.dateFormat).toBe('mdy');
      expect(result.timeFormat).toBe('12h');
      expect(result.distanceFormat).toBe('mi');
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences when validation passes', async () => {
      vi.mocked(preferenceQueries.validatePreferences).mockReturnValue({
        valid: true,
        errors: [],
      });
      vi.mocked(preferenceQueries.updateUserPreferences).mockResolvedValue({
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
      });

      const result = await preferenceService.updatePreferences(userId, { language: 'fr' });

      expect(result.language).toBe('fr');
      expect(preferenceQueries.updateUserPreferences).toHaveBeenCalledWith(userId, {
        language: 'fr',
      });
    });

    it('should throw error when validation fails', async () => {
      vi.mocked(preferenceQueries.validatePreferences).mockReturnValue({
        valid: false,
        errors: ['Invalid language: xx'],
      });

      await expect(preferenceService.updatePreferences(userId, { language: 'xx' }))
        .rejects
        .toThrow('Invalid language: xx');
    });

    it('should throw error with multiple validation errors joined', async () => {
      vi.mocked(preferenceQueries.validatePreferences).mockReturnValue({
        valid: false,
        errors: ['Invalid language: xx', 'Invalid dateFormat: abc'],
      });

      await expect(preferenceService.updatePreferences(userId, { language: 'xx', dateFormat: 'abc' }))
        .rejects
        .toThrow('Invalid language: xx; Invalid dateFormat: abc');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages list', () => {
      const result = preferenceService.getSupportedLanguages();

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].code).toBe('en');
      expect(result[1].code).toBe('fr');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('nativeName');
    });
  });

  describe('getDefaults', () => {
    it('should delegate to getDefaultsForLocale', () => {
      const mockDefaults = {
        language: 'fr',
        dateFormat: 'dmy',
        timeFormat: '24h',
        distanceFormat: 'km',
      };
      vi.mocked(preferenceQueries.getDefaultsForLocale).mockReturnValue(mockDefaults);

      const result = preferenceService.getDefaults('fr-FR');

      expect(preferenceQueries.getDefaultsForLocale).toHaveBeenCalledWith('fr-FR');
      expect(result.language).toBe('fr');
    });
  });

  describe('validate', () => {
    it('should return valid result for valid preferences', () => {
      vi.mocked(preferenceQueries.validatePreferences).mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = preferenceService.validate({ language: 'en' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result with errors', () => {
      vi.mocked(preferenceQueries.validatePreferences).mockReturnValue({
        valid: false,
        errors: ['Invalid language: xx'],
      });

      const result = preferenceService.validate({ language: 'xx' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid language: xx');
    });
  });
});
