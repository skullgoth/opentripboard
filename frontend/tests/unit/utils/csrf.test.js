import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CSRF Utility', () => {
  let getCsrfToken, getCsrfHeaders, withCsrfToken, clearCsrfToken, initCsrf;
  let originalFetch;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = globalThis.fetch;
    document.cookie = 'csrf_token=; max-age=0; path=/';

    const mod = await import('../../../src/utils/csrf.js');
    getCsrfToken = mod.getCsrfToken;
    getCsrfHeaders = mod.getCsrfHeaders;
    withCsrfToken = mod.withCsrfToken;
    clearCsrfToken = mod.clearCsrfToken;
    initCsrf = mod.initCsrf;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.cookie = 'csrf_token=; max-age=0; path=/';
  });

  describe('getCsrfToken', () => {
    it('should return token from cookie if available', async () => {
      document.cookie = 'csrf_token=test-token-123; path=/';
      const token = await getCsrfToken();
      expect(token).toBe('test-token-123');
    });

    it('should fetch token from server when no cookie', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ csrfToken: 'server-token' }),
      });

      const token = await getCsrfToken();
      expect(token).toBe('server-token');
    });

    it('should return cached token on subsequent calls', async () => {
      document.cookie = 'csrf_token=cached-token; path=/';
      const token1 = await getCsrfToken();
      const token2 = await getCsrfToken();
      expect(token1).toBe(token2);
    });
  });

  describe('clearCsrfToken', () => {
    it('should clear cached token', async () => {
      document.cookie = 'csrf_token=token; path=/';
      await getCsrfToken();
      clearCsrfToken();

      // After clearing, it should re-read from cookie
      document.cookie = 'csrf_token=new-token; path=/';
      const token = await getCsrfToken();
      expect(token).toBe('new-token');
    });
  });

  describe('getCsrfHeaders', () => {
    it('should return headers with token', async () => {
      document.cookie = 'csrf_token=header-token; path=/';
      const headers = await getCsrfHeaders();
      expect(headers['X-CSRF-Token']).toBe('header-token');
    });

    it('should return empty object when no token', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
      const headers = await getCsrfHeaders();
      expect(Object.keys(headers).length).toBe(0);
    });
  });

  describe('withCsrfToken', () => {
    it('should merge CSRF header with existing headers', async () => {
      document.cookie = 'csrf_token=merge-token; path=/';
      const headers = await withCsrfToken({ 'Content-Type': 'application/json' });
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-CSRF-Token']).toBe('merge-token');
    });

    it('should work with empty headers', async () => {
      document.cookie = 'csrf_token=empty-test; path=/';
      const headers = await withCsrfToken();
      expect(headers['X-CSRF-Token']).toBe('empty-test');
    });
  });

  describe('initCsrf', () => {
    it('should not throw on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));
      await expect(initCsrf()).resolves.toBeUndefined();
    });
  });
});
