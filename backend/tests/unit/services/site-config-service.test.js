/**
 * Unit tests for Site Config Service
 * Tests registration toggle, caching, and public settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import siteConfigService, {
  getRegistrationEnabled,
  updateRegistrationEnabled,
  getPublicSettings,
  clearCache,
} from '../../../src/services/site-config-service.js';
import * as siteConfigQueries from '../../../src/db/queries/site-config.js';

vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/site-config.js');

describe('Site Config Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always clear cache between tests to prevent cross-test pollution
    clearCache();
  });

  describe('getRegistrationEnabled', () => {
    it('should return registration status from database on first call', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(true);

      const result = await getRegistrationEnabled();

      expect(result).toBe(true);
      expect(siteConfigQueries.isRegistrationEnabled).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on subsequent calls within TTL', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(true);

      const result1 = await getRegistrationEnabled();
      const result2 = await getRegistrationEnabled();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Should only hit DB once due to caching
      expect(siteConfigQueries.isRegistrationEnabled).toHaveBeenCalledTimes(1);
    });

    it('should re-fetch from database after cache expiry', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      // First call populates cache
      const result1 = await getRegistrationEnabled();
      expect(result1).toBe(true);

      // Clear cache to simulate expiry
      clearCache();

      // Second call should hit DB again
      const result2 = await getRegistrationEnabled();
      expect(result2).toBe(false);
      expect(siteConfigQueries.isRegistrationEnabled).toHaveBeenCalledTimes(2);
    });

    it('should return false when registration is disabled', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(false);

      const result = await getRegistrationEnabled();

      expect(result).toBe(false);
    });
  });

  describe('updateRegistrationEnabled', () => {
    it('should update registration status and return the new value', async () => {
      vi.mocked(siteConfigQueries.setRegistrationEnabled).mockResolvedValue();

      const result = await updateRegistrationEnabled(false);

      expect(result).toBe(false);
      expect(siteConfigQueries.setRegistrationEnabled).toHaveBeenCalledWith(false);
    });

    it('should update the cache immediately', async () => {
      vi.mocked(siteConfigQueries.setRegistrationEnabled).mockResolvedValue();
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(true);

      await updateRegistrationEnabled(false);

      // Subsequent get should use cached value, not hit DB
      const result = await getRegistrationEnabled();
      expect(result).toBe(false);
      expect(siteConfigQueries.isRegistrationEnabled).not.toHaveBeenCalled();
    });

    it('should enable registration', async () => {
      vi.mocked(siteConfigQueries.setRegistrationEnabled).mockResolvedValue();

      const result = await updateRegistrationEnabled(true);

      expect(result).toBe(true);
    });
  });

  describe('getPublicSettings', () => {
    it('should return public settings including registration status', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(true);

      const result = await getPublicSettings();

      expect(result).toEqual({ registrationEnabled: true });
    });

    it('should reflect disabled registration', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled).mockResolvedValue(false);

      const result = await getPublicSettings();

      expect(result).toEqual({ registrationEnabled: false });
    });
  });

  describe('clearCache', () => {
    it('should force next call to fetch from database', async () => {
      vi.mocked(siteConfigQueries.isRegistrationEnabled)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await getRegistrationEnabled(); // Populate cache
      clearCache();
      const result = await getRegistrationEnabled();

      expect(result).toBe(false);
      expect(siteConfigQueries.isRegistrationEnabled).toHaveBeenCalledTimes(2);
    });
  });

  describe('default export', () => {
    it('should export all functions', () => {
      expect(siteConfigService.getRegistrationEnabled).toBeDefined();
      expect(siteConfigService.updateRegistrationEnabled).toBeDefined();
      expect(siteConfigService.getPublicSettings).toBeDefined();
      expect(siteConfigService.clearCache).toBeDefined();
    });
  });
});
