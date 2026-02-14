import { describe, it, expect, vi } from 'vitest';
import {
  generateETag,
  setCacheHeaders,
  checkNotModified,
  cacheConfig,
} from '../../../src/middleware/cache.js';

describe('Cache Middleware', () => {
  function createMockReply() {
    return {
      header: vi.fn().mockReturnThis(),
    };
  }

  function createMockRequest(headers = {}) {
    return { headers };
  }

  describe('cacheConfig', () => {
    it('should have static config with long max age', () => {
      expect(cacheConfig.static.maxAge).toBe(31536000);
      expect(cacheConfig.static.immutable).toBe(true);
    });

    it('should have private config with no caching', () => {
      expect(cacheConfig.private.maxAge).toBe(0);
      expect(cacheConfig.private.mustRevalidate).toBe(true);
      expect(cacheConfig.private.private).toBe(true);
    });

    it('should have shared config with 5 min cache', () => {
      expect(cacheConfig.shared.maxAge).toBe(300);
    });

    it('should have api config with 1 min cache', () => {
      expect(cacheConfig.api.maxAge).toBe(60);
      expect(cacheConfig.api.private).toBe(true);
    });

    it('should have noCache config', () => {
      expect(cacheConfig.noCache.noStore).toBe(true);
      expect(cacheConfig.noCache.noCache).toBe(true);
      expect(cacheConfig.noCache.mustRevalidate).toBe(true);
    });
  });

  describe('generateETag', () => {
    it('should generate ETag for string body', () => {
      const etag = generateETag('hello');
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate ETag for object body', () => {
      const etag = generateETag({ key: 'value' });
      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate consistent ETags for same content', () => {
      const etag1 = generateETag('hello');
      const etag2 = generateETag('hello');
      expect(etag1).toBe(etag2);
    });

    it('should generate different ETags for different content', () => {
      const etag1 = generateETag('hello');
      const etag2 = generateETag('world');
      expect(etag1).not.toBe(etag2);
    });
  });

  describe('setCacheHeaders', () => {
    it('should set Cache-Control header', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.shared);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=300')
      );
    });

    it('should set ETag when provided', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.api, '"test-etag"');

      expect(reply.header).toHaveBeenCalledWith('ETag', '"test-etag"');
    });

    it('should set Vary header', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.api);

      expect(reply.header).toHaveBeenCalledWith('Vary', 'Accept, Authorization');
    });

    it('should set private directive for private config', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.private);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('private')
      );
    });

    it('should set public directive for shared config', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.shared);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('public')
      );
    });

    it('should set no-store for noCache config', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.noCache);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store')
      );
    });

    it('should set immutable for static config', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.static);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('immutable')
      );
    });

    it('should set stale-while-revalidate', () => {
      const reply = createMockReply();
      setCacheHeaders(reply, cacheConfig.shared);

      expect(reply.header).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('stale-while-revalidate=60')
      );
    });
  });

  describe('checkNotModified', () => {
    it('should return true when ETags match', () => {
      const request = createMockRequest({ 'if-none-match': '"test-etag"' });
      expect(checkNotModified(request, '"test-etag"')).toBe(true);
    });

    it('should return false when ETags do not match', () => {
      const request = createMockRequest({ 'if-none-match': '"old-etag"' });
      expect(checkNotModified(request, '"new-etag"')).toBe(false);
    });

    it('should return falsy when no If-None-Match header', () => {
      const request = createMockRequest({});
      expect(checkNotModified(request, '"test-etag"')).toBeFalsy();
    });
  });
});
