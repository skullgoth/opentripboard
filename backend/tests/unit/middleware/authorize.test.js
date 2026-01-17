
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireTripAccess, checkResourceOwnership } from '../../../src/middleware/authorize.js';
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

describe('Authorization Middleware - checkResourceOwnership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Valid table/column combinations', () => {
    it('should return true when user owns the resource with default owner_id column', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'trip-123' }], rowCount: 1 });

      const result = await checkResourceOwnership('trips', 'trip-123', 'user-123');

      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        'SELECT id FROM trips WHERE id = $1 AND owner_id = $2',
        ['trip-123', 'user-123']
      );
    });

    it('should return true when user owns the resource with custom column', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'activity-123' }], rowCount: 1 });

      const result = await checkResourceOwnership('activities', 'activity-123', 'user-123', 'created_by');

      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        'SELECT id FROM activities WHERE id = $1 AND created_by = $2',
        ['activity-123', 'user-123']
      );
    });

    it('should return false when user does not own the resource', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await checkResourceOwnership('trips', 'trip-123', 'user-456');

      expect(result).toBe(false);
    });

    it('should support all whitelisted tables', async () => {
      const validTableColumnPairs = [
        { table: 'trips', column: 'owner_id' },
        { table: 'activities', column: 'created_by' },
        { table: 'suggestions', column: 'suggested_by_user_id' },
        { table: 'expenses', column: 'payer_id' },
        { table: 'lists', column: 'created_by' },
        { table: 'documents', column: 'uploaded_by' },
        { table: 'users', column: 'id' },
      ];

      for (const { table, column } of validTableColumnPairs) {
        vi.resetAllMocks();
        query.mockResolvedValueOnce({ rows: [{ id: 'resource-123' }], rowCount: 1 });

        const result = await checkResourceOwnership(table, 'resource-123', 'user-123', column);

        expect(result).toBe(true);
      }
    });

    it('should support all whitelisted columns for activities table', async () => {
      const validColumns = ['created_by', 'updated_by'];

      for (const column of validColumns) {
        vi.resetAllMocks();
        query.mockResolvedValueOnce({ rows: [{ id: 'activity-123' }], rowCount: 1 });

        const result = await checkResourceOwnership('activities', 'activity-123', 'user-123', column);

        expect(result).toBe(true);
        expect(query).toHaveBeenCalledWith(
          `SELECT id FROM activities WHERE id = $1 AND ${column} = $2`,
          ['activity-123', 'user-123']
        );
      }
    });
  });

  describe('SQL injection protection', () => {
    it('should reject SQL injection attempt in table name', async () => {
      const maliciousTable = "trips; DROP TABLE users; --";

      await expect(
        checkResourceOwnership(maliciousTable, 'trip-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempt with UNION in table name', async () => {
      const maliciousTable = "trips UNION SELECT * FROM users";

      await expect(
        checkResourceOwnership(maliciousTable, 'trip-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempt in column name', async () => {
      const maliciousColumn = "owner_id = owner_id OR 1=1; --";

      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', maliciousColumn)
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempt with comment in column name', async () => {
      const maliciousColumn = "owner_id -- malicious comment";

      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', maliciousColumn)
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject SQL injection attempt with OR clause in column name', async () => {
      const maliciousColumn = "owner_id OR 1=1";

      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', maliciousColumn)
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('Invalid table names', () => {
    it('should reject non-whitelisted table name', async () => {
      await expect(
        checkResourceOwnership('malicious_table', 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name: malicious_table/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject empty table name', async () => {
      await expect(
        checkResourceOwnership('', 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject table name with special characters', async () => {
      await expect(
        checkResourceOwnership('trips@#$', 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject table name with spaces', async () => {
      await expect(
        checkResourceOwnership('trips table', 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should provide helpful error message listing allowed tables', async () => {
      await expect(
        checkResourceOwnership('invalid_table', 'resource-123', 'user-123')
      ).rejects.toThrow(/Allowed tables: trips, activities, suggestions, expenses, lists, documents, users/);
    });
  });

  describe('Invalid column names', () => {
    it('should reject non-whitelisted column name for trips table', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', 'malicious_column')
      ).rejects.toThrow(/Invalid owner column: malicious_column for table trips/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject column name valid for different table', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', 'created_by')
      ).rejects.toThrow(/Invalid owner column: created_by for table trips/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject empty column name', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', '')
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should reject column name with special characters', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', 'owner_id; DROP TABLE')
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should provide helpful error message listing allowed columns for table', async () => {
      await expect(
        checkResourceOwnership('activities', 'activity-123', 'user-123', 'owner_id')
      ).rejects.toThrow(/Allowed columns: created_by, updated_by/);
    });
  });

  describe('Edge cases', () => {
    it('should handle null table name', async () => {
      await expect(
        checkResourceOwnership(null, 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle undefined table name', async () => {
      await expect(
        checkResourceOwnership(undefined, 'resource-123', 'user-123')
      ).rejects.toThrow(/Invalid table name/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle null column name', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', null)
      ).rejects.toThrow(/Invalid owner column/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle undefined column name with default owner_id', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'trip-123' }], rowCount: 1 });

      const result = await checkResourceOwnership('trips', 'trip-123', 'user-123', undefined);

      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        'SELECT id FROM trips WHERE id = $1 AND owner_id = $2',
        ['trip-123', 'user-123']
      );
    });

    it('should handle case-sensitive table names', async () => {
      await expect(
        checkResourceOwnership('TRIPS', 'trip-123', 'user-123')
      ).rejects.toThrow(/Invalid table name: TRIPS/);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive column names', async () => {
      await expect(
        checkResourceOwnership('trips', 'trip-123', 'user-123', 'OWNER_ID')
      ).rejects.toThrow(/Invalid owner column: OWNER_ID/);

      expect(query).not.toHaveBeenCalled();
    });
  });
});
