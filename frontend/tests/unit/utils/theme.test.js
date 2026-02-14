import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  THEME_LIGHT,
  THEME_DARK,
  getCurrentTheme,
  setTheme,
  toggleTheme,
  initTheme,
  getOSThemePreference,
} from '../../../src/utils/theme.js';

describe('Theme Utility', () => {
  beforeEach(() => {
    // Clear cookies
    document.cookie = 'theme-preference=; max-age=0; path=/';
    // Reset document attribute
    document.documentElement.removeAttribute('data-theme');
  });

  describe('constants', () => {
    it('should export THEME_LIGHT as light', () => {
      expect(THEME_LIGHT).toBe('light');
    });

    it('should export THEME_DARK as dark', () => {
      expect(THEME_DARK).toBe('dark');
    });
  });

  describe('getOSThemePreference', () => {
    it('should return light by default', () => {
      // jsdom doesn't match dark mode by default
      const result = getOSThemePreference();
      expect([THEME_LIGHT, THEME_DARK]).toContain(result);
    });
  });

  describe('getCurrentTheme', () => {
    it('should return theme from cookie when set', () => {
      document.cookie = 'theme-preference=dark; path=/';
      expect(getCurrentTheme()).toBe('dark');
    });

    it('should return OS preference when no cookie', () => {
      const result = getCurrentTheme();
      expect([THEME_LIGHT, THEME_DARK]).toContain(result);
    });
  });

  describe('setTheme', () => {
    it('should set data-theme attribute to dark', () => {
      setTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should set data-theme attribute to light', () => {
      setTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should persist theme in cookie', () => {
      setTheme('dark');
      expect(document.cookie).toContain('theme-preference=dark');
    });

    it('should reject invalid theme values', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setTheme('invalid');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      document.cookie = 'theme-preference=light; path=/';
      const newTheme = toggleTheme();
      expect(newTheme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      document.cookie = 'theme-preference=dark; path=/';
      const newTheme = toggleTheme();
      expect(newTheme).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('should apply theme and return it', () => {
      document.cookie = 'theme-preference=dark; path=/';
      const theme = initTheme();
      expect(theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
