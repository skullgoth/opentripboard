import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Router', () => {
  let router;

  beforeEach(async () => {
    vi.resetModules();
    window.location.hash = '';
    const mod = await import('../../../src/utils/router.js');
    router = mod.default;
    // Reset internal state
    router.routes = new Map();
    router.currentRoute = null;
    router.beforeHooks = [];
    router.afterHooks = [];
    router.started = false;
  });

  describe('addRoute', () => {
    it('should register a route', () => {
      const handler = vi.fn();
      router.addRoute('/test', handler);
      expect(router.routes.has('/test')).toBe(true);
    });
  });

  describe('addRoutes', () => {
    it('should register multiple routes', () => {
      const routes = {
        '/a': vi.fn(),
        '/b': vi.fn(),
      };
      router.addRoutes(routes);
      expect(router.routes.has('/a')).toBe(true);
      expect(router.routes.has('/b')).toBe(true);
    });
  });

  describe('matchRoute', () => {
    it('should match exact routes', () => {
      const handler = vi.fn();
      router.addRoute('/trips', handler);
      const result = router.matchRoute('/trips');
      expect(result.handler).toBe(handler);
      expect(result.params).toEqual({});
    });

    it('should match dynamic routes', () => {
      const handler = vi.fn();
      router.addRoute('/trip/:id', handler);
      const result = router.matchRoute('/trip/123');
      expect(result.handler).toBe(handler);
      expect(result.params).toEqual({ id: '123' });
    });

    it('should return null handler for unmatched routes', () => {
      const result = router.matchRoute('/nonexistent');
      expect(result.handler).toBeNull();
    });

    it('should handle multiple dynamic params', () => {
      const handler = vi.fn();
      router.addRoute('/trip/:tripId/activity/:actId', handler);
      const result = router.matchRoute('/trip/abc/activity/xyz');
      expect(result.params).toEqual({ tripId: 'abc', actId: 'xyz' });
    });
  });

  describe('extractParams', () => {
    it('should return null for different segment counts', () => {
      const result = router.extractParams('/a/b', '/a/b/c');
      expect(result).toBeNull();
    });

    it('should return null for non-matching static segments', () => {
      const result = router.extractParams('/trips/:id', '/users/123');
      expect(result).toBeNull();
    });

    it('should decode URI components', () => {
      const result = router.extractParams('/trip/:name', '/trip/hello%20world');
      expect(result).toEqual({ name: 'hello world' });
    });
  });

  describe('navigate', () => {
    it('should set window.location.hash', () => {
      router.navigate('/trips');
      expect(window.location.hash).toBe('#/trips');
    });
  });

  describe('getCurrentRoute', () => {
    it('should return null before starting', () => {
      expect(router.getCurrentRoute()).toBeNull();
    });
  });

  describe('beforeEach / afterEach hooks', () => {
    it('should register before hooks', () => {
      const hook = vi.fn();
      router.beforeEach(hook);
      expect(router.beforeHooks).toContain(hook);
    });

    it('should register after hooks', () => {
      const hook = vi.fn();
      router.afterEach(hook);
      expect(router.afterHooks).toContain(hook);
    });
  });

  describe('handleRouteChange', () => {
    it('should call matched route handler', async () => {
      const handler = vi.fn();
      router.addRoute('/', handler);
      window.location.hash = '';
      await router.handleRouteChange();
      expect(handler).toHaveBeenCalledWith({});
    });

    it('should call before hooks', async () => {
      const hook = vi.fn(() => true);
      const handler = vi.fn();
      router.addRoute('/', handler);
      router.beforeEach(hook);
      await router.handleRouteChange();
      expect(hook).toHaveBeenCalled();
    });

    it('should stop navigation if before hook returns false', async () => {
      const hook = vi.fn(() => false);
      const handler = vi.fn();
      router.addRoute('/', handler);
      router.beforeEach(hook);
      await router.handleRouteChange();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call after hooks', async () => {
      const hook = vi.fn();
      const handler = vi.fn();
      router.addRoute('/', handler);
      router.afterEach(hook);
      await router.handleRouteChange();
      expect(hook).toHaveBeenCalled();
    });
  });
});
