import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/state/preferences-state.js', () => ({
  getPreferences: vi.fn(() => ({ language: 'en' })),
}));

describe('i18n Utility', () => {
  let t, getLanguage, onLanguageChange, isI18nLoaded, SUPPORTED_LANGUAGES, setLanguage, initI18n;

  beforeEach(async () => {
    vi.resetModules();

    // Mock fetch for loading translations
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          nav: { home: 'Home', trips: 'Trips' },
          greeting: 'Hello {{name}}',
        }),
    });

    const mod = await import('../../../src/utils/i18n.js');
    t = mod.t;
    getLanguage = mod.getLanguage;
    onLanguageChange = mod.onLanguageChange;
    isI18nLoaded = mod.isI18nLoaded;
    SUPPORTED_LANGUAGES = mod.SUPPORTED_LANGUAGES;
    setLanguage = mod.setLanguage;
    initI18n = mod.initI18n;
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should include en, fr, es', () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('fr');
      expect(codes).toContain('es');
    });

    it('should have code and name for each language', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(lang).toHaveProperty('nativeName');
      });
    });
  });

  describe('getLanguage', () => {
    it('should return current language', () => {
      expect(getLanguage()).toBe('en');
    });
  });

  describe('initI18n', () => {
    it('should load translations', async () => {
      await initI18n('en');
      expect(globalThis.fetch).toHaveBeenCalledWith('/locales/en.json');
    });

    it('should set isLoaded to true', async () => {
      await initI18n('en');
      expect(isI18nLoaded()).toBe(true);
    });

    it('should load both English and requested language', async () => {
      await initI18n('fr');
      expect(globalThis.fetch).toHaveBeenCalledWith('/locales/en.json');
      expect(globalThis.fetch).toHaveBeenCalledWith('/locales/fr.json');
    });
  });

  describe('t', () => {
    it('should translate dot-notation keys', async () => {
      await initI18n('en');
      expect(t('nav.home')).toBe('Home');
    });

    it('should return key when translation not found', async () => {
      await initI18n('en');
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should interpolate parameters', async () => {
      await initI18n('en');
      expect(t('greeting', { name: 'World' })).toBe('Hello World');
    });
  });

  describe('setLanguage', () => {
    it('should change current language', async () => {
      await initI18n('en');
      await setLanguage('fr');
      expect(getLanguage()).toBe('fr');
    });

    it('should warn for unsupported language', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await setLanguage('xx');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported'));
      consoleSpy.mockRestore();
    });
  });

  describe('onLanguageChange', () => {
    it('should notify listeners on language change', async () => {
      await initI18n('en');
      const listener = vi.fn();
      onLanguageChange(listener);
      await setLanguage('fr');
      expect(listener).toHaveBeenCalledWith('fr');
    });

    it('should return unsubscribe function', async () => {
      await initI18n('en');
      const listener = vi.fn();
      const unsub = onLanguageChange(listener);
      unsub();
      await setLanguage('fr');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
