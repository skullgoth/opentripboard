
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireTripAccess } from '../../../src/middleware/authorize.js';
import { query } from '../../../src/db/connection.js';

vi.mock('../../../src/db/connection.js', () => ({
  query: vi.fn(),
}));

describe('Authorization Middleware - requireTripAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call next if user is the owner', async () => {
    const request = {
      user: { userId: 'user-123' },
      params: { id: 'trip-123' },
    };
    const reply = {
      code: vi.fn(() => reply),
      send: vi.fn(),
    };
    const done = vi.fn();

    query.mockResolvedValueOnce({ rows: [{ id: 'trip-123', owner_id: 'user-123' }], rowCount: 1 });

    await requireTripAccess(request, reply, done);

    expect(request.tripAccess).toEqual({ tripId: 'trip-123', role: 'owner', hasAccess: true });
  });

  it('should call next if user is a trip buddy', async () => {
    const request = {
      user: { userId: 'user-456' },
      params: { id: 'trip-123' },
    };
    const reply = {
      code: vi.fn(() => reply),
      send: vi.fn(),
    };
    const done = vi.fn();

    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // for owner check
    query.mockResolvedValueOnce({ rows: [{ trip_id: 'trip-123', role: 'editor' }], rowCount: 1 });

    await requireTripAccess(request, reply, done);

    expect(request.tripAccess).toEqual({ tripId: 'trip-123', role: 'editor', hasAccess: true });
  });

  it('should send 403 if user has no access', async () => {
    const request = {
      user: { userId: 'user-789' },
      params: { id: 'trip-123' },
    };
    const reply = {
      code: vi.fn(() => reply),
      send: vi.fn(),
    };
    const done = vi.fn();

    query.mockResolvedValue({ rows: [], rowCount: 0 });

    await requireTripAccess(request, reply, done);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'You do not have access to this trip',
    });
  });

  it('should send 401 if user is not authenticated', async () => {
    const request = {
      params: { id: 'trip-123' },
    };
    const reply = {
      code: vi.fn(() => reply),
      send: vi.fn(),
    };
    const done = vi.fn();

    await requireTripAccess(request, reply, done);

    expect(reply.code).toHaveBeenCalledWith(401);
  });
});
