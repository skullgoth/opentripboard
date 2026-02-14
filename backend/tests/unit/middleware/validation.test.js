import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Validation Middleware', () => {
  let validateBody, validateQuery, validateParams, schemas;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../src/middleware/validation.js');
    validateBody = mod.validateBody;
    validateQuery = mod.validateQuery;
    validateParams = mod.validateParams;
    schemas = mod.schemas;
  });

  function createMockRequest(data = {}) {
    return { body: data.body || {}, query: data.query || {}, params: data.params || {} };
  }

  function createMockReply() {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return reply;
  }

  describe('validateBody', () => {
    it('should pass valid body', async () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1 } },
      };

      const middleware = validateBody(schema);
      const req = createMockRequest({ body: { name: 'Test' } });
      const reply = createMockReply();

      const result = await middleware(req, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should reject invalid body', async () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      };

      const middleware = validateBody(schema);
      const req = createMockRequest({ body: {} });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          message: 'Request body validation failed',
        })
      );
    });

    it('should return all validation errors', async () => {
      const schema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      };

      const middleware = validateBody(schema);
      const req = createMockRequest({ body: {} });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
            expect.objectContaining({ field: 'email' }),
          ]),
        })
      );
    });
  });

  describe('validateQuery', () => {
    it('should pass valid query', async () => {
      const schema = {
        type: 'object',
        properties: { page: { type: 'integer', minimum: 1 } },
      };

      const middleware = validateQuery(schema);
      const req = createMockRequest({ query: { page: 1 } });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should reject invalid query', async () => {
      const schema = {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string' } },
      };

      const middleware = validateQuery(schema);
      const req = createMockRequest({ query: {} });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Query parameters validation failed',
        })
      );
    });
  });

  describe('validateParams', () => {
    it('should pass valid params', async () => {
      const schema = {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      };

      const middleware = validateParams(schema);
      const req = createMockRequest({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should reject invalid params', async () => {
      const schema = {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      };

      const middleware = validateParams(schema);
      const req = createMockRequest({ params: { id: 'not-a-uuid' } });
      const reply = createMockReply();

      await middleware(req, reply);
      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route parameters validation failed',
        })
      );
    });
  });

  describe('schemas', () => {
    it('should export common schemas', () => {
      expect(schemas.uuid).toBeDefined();
      expect(schemas.email).toBeDefined();
      expect(schemas.password).toBeDefined();
      expect(schemas.date).toBeDefined();
      expect(schemas.dateTime).toBeDefined();
      expect(schemas.positiveInteger).toBeDefined();
      expect(schemas.nonNegativeNumber).toBeDefined();
    });

    it('should have correct uuid format', () => {
      expect(schemas.uuid.format).toBe('uuid');
    });

    it('should have correct email format', () => {
      expect(schemas.email.format).toBe('email');
    });

    it('should have correct password constraints', () => {
      expect(schemas.password.minLength).toBe(8);
      expect(schemas.password.maxLength).toBe(128);
    });
  });
});
