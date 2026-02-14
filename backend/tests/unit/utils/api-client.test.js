import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NominatimClient,
  PexelsClient,
  createNominatimClient,
  createPexelsClient,
} from '../../../src/utils/api-client.js';

describe('API Client', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('NominatimClient', () => {
    let client;

    beforeEach(() => {
      client = new NominatimClient();
    });

    it('should have correct baseUrl', () => {
      expect(client.baseUrl).toBe('https://nominatim.openstreetmap.org');
    });

    it('should have user agent', () => {
      expect(client.userAgent).toBeDefined();
    });

    it('should search with correct parameters', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ display_name: 'Paris' }]),
      });

      const results = await client.search('Paris', 5, 'en');
      expect(results).toEqual([{ display_name: 'Paris' }]);

      const callUrl = globalThis.fetch.mock.calls[0][0];
      expect(callUrl).toContain('q=Paris');
      expect(callUrl).toContain('format=json');
      expect(callUrl).toContain('limit=5');
    });

    it('should throw RATE_LIMIT_EXCEEDED on 429', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(client.search('Paris')).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('should throw SERVICE_UNAVAILABLE on 503', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(client.search('Paris')).rejects.toThrow('SERVICE_UNAVAILABLE');
    });

    it('should throw REQUEST_TIMEOUT on abort', async () => {
      globalThis.fetch.mockImplementationOnce(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(client.search('Paris')).rejects.toThrow('REQUEST_TIMEOUT');
    });

    it('should throw on other HTTP errors', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.search('Paris')).rejects.toThrow('HTTP 500');
    });
  });

  describe('PexelsClient', () => {
    let client;

    beforeEach(() => {
      process.env.PEXELS_API_KEY = 'test-api-key';
      client = new PexelsClient();
    });

    afterEach(() => {
      delete process.env.PEXELS_API_KEY;
    });

    it('should have correct baseUrl', () => {
      expect(client.baseUrl).toBe('https://api.pexels.com/v1');
    });

    it('should search with correct parameters', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ photos: [{ id: 1 }] }),
      });

      const results = await client.search('beach');
      expect(results).toEqual({ photos: [{ id: 1 }] });

      const callUrl = globalThis.fetch.mock.calls[0][0];
      expect(callUrl).toContain('query=beach');
      expect(callUrl).toContain('orientation=landscape');
    });

    it('should throw PEXELS_API_KEY_NOT_CONFIGURED when key missing', async () => {
      client.apiKey = undefined;
      await expect(client.search('beach')).rejects.toThrow('PEXELS_API_KEY_NOT_CONFIGURED');
    });

    it('should throw PEXELS_API_KEY_NOT_CONFIGURED for placeholder key', async () => {
      client.apiKey = 'your_pexels_api_key_here';
      await expect(client.search('beach')).rejects.toThrow('PEXELS_API_KEY_NOT_CONFIGURED');
    });

    it('should throw RATE_LIMIT_EXCEEDED on 429', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(client.search('beach')).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('should throw INVALID_API_KEY on 401', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.search('beach')).rejects.toThrow('INVALID_API_KEY');
    });

    it('should download image as buffer', async () => {
      const mockData = new ArrayBuffer(8);
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData),
      });

      const buffer = await client.downloadImage('https://example.com/image.jpg');
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should throw IMAGE_DOWNLOAD_TIMEOUT on abort', async () => {
      globalThis.fetch.mockImplementationOnce(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(client.downloadImage('https://example.com/image.jpg')).rejects.toThrow(
        'IMAGE_DOWNLOAD_TIMEOUT'
      );
    });
  });

  describe('factory functions', () => {
    it('should create NominatimClient instance', () => {
      const client = createNominatimClient();
      expect(client).toBeInstanceOf(NominatimClient);
    });

    it('should create PexelsClient instance', () => {
      process.env.PEXELS_API_KEY = 'test';
      const client = createPexelsClient();
      expect(client).toBeInstanceOf(PexelsClient);
      delete process.env.PEXELS_API_KEY;
    });
  });
});
