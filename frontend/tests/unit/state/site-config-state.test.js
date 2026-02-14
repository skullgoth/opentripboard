/**
 * Unit tests for Site Config State Management
 * Tests state functions from src/state/site-config-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

let mod;

describe('Site Config State', () => {
  beforeEach(async () => {
    vi.resetModules();
    mod = await import('../../../src/state/site-config-state.js');
  });

  // ─── getSiteConfig ────────────────────────────────────────
  describe('getSiteConfig', () => {
    it('should return null when config is not loaded', () => {
      expect(mod.getSiteConfig()).toBeNull();
    });

    it('should return config after setSiteConfig', () => {
      mod.setSiteConfig({ registrationEnabled: true });
      const config = mod.getSiteConfig();
      expect(config).toEqual({ registrationEnabled: true });
    });

    it('should return a copy, not a reference', () => {
      mod.setSiteConfig({ registrationEnabled: true });
      const config1 = mod.getSiteConfig();
      const config2 = mod.getSiteConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should not be affected by mutating the returned object', () => {
      mod.setSiteConfig({ registrationEnabled: true });
      const config = mod.getSiteConfig();
      config.registrationEnabled = false;
      expect(mod.getSiteConfig().registrationEnabled).toBe(true);
    });
  });

  // ─── setSiteConfig ────────────────────────────────────────
  describe('setSiteConfig', () => {
    it('should set the config', () => {
      mod.setSiteConfig({ registrationEnabled: false });
      expect(mod.getSiteConfig()).toEqual({ registrationEnabled: false });
    });

    it('should mark config as loaded', () => {
      expect(mod.isSiteConfigLoaded()).toBe(false);
      mod.setSiteConfig({ registrationEnabled: true });
      expect(mod.isSiteConfigLoaded()).toBe(true);
    });

    it('should store a copy of the input', () => {
      const input = { registrationEnabled: true };
      mod.setSiteConfig(input);
      input.registrationEnabled = false;
      expect(mod.getSiteConfig().registrationEnabled).toBe(true);
    });

    it('should notify subscribers', () => {
      const callback = vi.fn();
      mod.subscribeToSiteConfig(callback);

      mod.setSiteConfig({ registrationEnabled: true });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ registrationEnabled: true }),
      );
    });
  });

  // ─── isRegistrationEnabled ────────────────────────────────
  describe('isRegistrationEnabled', () => {
    it('should return true by default when config is not loaded', () => {
      expect(mod.isRegistrationEnabled()).toBe(true);
    });

    it('should return true when registration is enabled', () => {
      mod.setSiteConfig({ registrationEnabled: true });
      expect(mod.isRegistrationEnabled()).toBe(true);
    });

    it('should return false when registration is disabled', () => {
      mod.setSiteConfig({ registrationEnabled: false });
      expect(mod.isRegistrationEnabled()).toBe(false);
    });
  });

  // ─── isSiteConfigLoaded ───────────────────────────────────
  describe('isSiteConfigLoaded', () => {
    it('should return false initially', () => {
      expect(mod.isSiteConfigLoaded()).toBe(false);
    });

    it('should return true after setSiteConfig', () => {
      mod.setSiteConfig({ registrationEnabled: true });
      expect(mod.isSiteConfigLoaded()).toBe(true);
    });
  });

  // ─── subscribeToSiteConfig ────────────────────────────────
  describe('subscribeToSiteConfig', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = mod.subscribeToSiteConfig(callback);

      mod.setSiteConfig({ registrationEnabled: true });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      mod.setSiteConfig({ registrationEnabled: false });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      mod.subscribeToSiteConfig(cb1);
      mod.subscribeToSiteConfig(cb2);

      mod.setSiteConfig({ registrationEnabled: true });

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('should not crash if subscriber throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorCb = vi.fn(() => {
        throw new Error('subscriber error');
      });
      const normalCb = vi.fn();

      mod.subscribeToSiteConfig(errorCb);
      mod.subscribeToSiteConfig(normalCb);

      expect(() => mod.setSiteConfig({ registrationEnabled: true })).not.toThrow();
      expect(normalCb).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });

    it('should pass the config to the callback', () => {
      const callback = vi.fn();
      mod.subscribeToSiteConfig(callback);

      mod.setSiteConfig({ registrationEnabled: false, siteName: 'Test' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ registrationEnabled: false, siteName: 'Test' }),
      );
    });
  });

  // ─── siteConfigState facade ───────────────────────────────
  describe('siteConfigState facade object', () => {
    it('should expose all methods via the facade', () => {
      const facade = mod.siteConfigState;
      expect(typeof facade.get).toBe('function');
      expect(typeof facade.set).toBe('function');
      expect(typeof facade.isRegistrationEnabled).toBe('function');
      expect(typeof facade.isLoaded).toBe('function');
      expect(typeof facade.subscribe).toBe('function');
    });

    it('should work via facade methods', () => {
      const facade = mod.siteConfigState;
      facade.set({ registrationEnabled: false });
      expect(facade.get()).toEqual({ registrationEnabled: false });
      expect(facade.isRegistrationEnabled()).toBe(false);
      expect(facade.isLoaded()).toBe(true);
    });
  });
});
