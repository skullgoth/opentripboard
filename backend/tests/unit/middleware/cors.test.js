import { describe, it, expect, vi } from 'vitest';

// cors.js uses CommonJS (module.exports), so import it accordingly
const { corsMiddleware } = await import('../../../src/middleware/cors.js');

describe('CORS Middleware', () => {
  function createMockReq(headers = {}) {
    return { headers, method: 'GET' };
  }

  function createMockRes() {
    return {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
  }

  it('should set Access-Control-Allow-Origin for string origin', () => {
    const middleware = corsMiddleware({ origin: 'http://localhost:3000' });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:3000'
    );
    expect(next).toHaveBeenCalled();
  });

  it('should set matching origin from array', () => {
    const middleware = corsMiddleware({
      origin: ['http://localhost:3000', 'http://example.com'],
    });
    const req = createMockReq({ origin: 'http://example.com' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://example.com'
    );
  });

  it('should not set origin header for non-matching array origin', () => {
    const middleware = corsMiddleware({
      origin: ['http://localhost:3000'],
    });
    const req = createMockReq({ origin: 'http://evil.com' });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    const originCalls = res.setHeader.mock.calls.filter(
      (c) => c[0] === 'Access-Control-Allow-Origin'
    );
    expect(originCalls).toHaveLength(0);
  });

  it('should set Allow-Methods header', () => {
    const middleware = corsMiddleware();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      expect.stringContaining('GET')
    );
  });

  it('should set Allow-Headers header', () => {
    const middleware = corsMiddleware();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      expect.stringContaining('Content-Type')
    );
  });

  it('should set Allow-Credentials when credentials is true', () => {
    const middleware = corsMiddleware({ credentials: true });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Credentials',
      'true'
    );
  });

  it('should not set Allow-Credentials when credentials is false', () => {
    const middleware = corsMiddleware({ credentials: false });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    const credCalls = res.setHeader.mock.calls.filter(
      (c) => c[0] === 'Access-Control-Allow-Credentials'
    );
    expect(credCalls).toHaveLength(0);
  });

  it('should handle OPTIONS preflight with 204', () => {
    const middleware = corsMiddleware();
    const req = createMockReq();
    req.method = 'OPTIONS';
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next for non-OPTIONS requests', () => {
    const middleware = corsMiddleware();
    const req = createMockReq();
    req.method = 'POST';
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
