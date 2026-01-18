/**
 * Unit tests for Refresh Tokens Query Module
 * Tests database operations for refresh token storage, retrieval, and management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as refreshTokenQueries from '../../../../src/db/queries/refresh-tokens.js';
import * as dbConnection from '../../../../src/db/connection.js';

// Mock the database connection
vi.mock('../../../../src/db/connection.js', () => ({
  query: vi.fn(),
}));

// Mock console to keep test output clean
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Refresh Tokens Query Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeRefreshToken', () => {
    it('should store a new refresh token successfully', async () => {
      const tokenData = {
        userId: 'user-123',
        tokenHash: 'hashed-token-abc',
        familyId: 'family-xyz',
        expiresAt: new Date('2025-01-01'),
      };

      const mockResult = {
        rows: [{
          id: 'token-id-1',
          user_id: 'user-123',
          token_hash: 'hashed-token-abc',
          family_id: 'family-xyz',
          used_at: null,
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.storeRefreshToken(tokenData);

      expect(result).toBeDefined();
      expect(result.id).toBe('token-id-1');
      expect(result.user_id).toBe('user-123');
      expect(result.token_hash).toBe('hashed-token-abc');
      expect(result.family_id).toBe('family-xyz');
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        ['user-123', 'hashed-token-abc', 'family-xyz', tokenData.expiresAt]
      );
    });

    it('should return token with null used_at and revoked_at', async () => {
      const tokenData = {
        userId: 'user-456',
        tokenHash: 'hash-456',
        familyId: 'family-456',
        expiresAt: new Date('2025-06-01'),
      };

      const mockResult = {
        rows: [{
          id: 'token-id-2',
          user_id: 'user-456',
          token_hash: 'hash-456',
          family_id: 'family-456',
          used_at: null,
          revoked_at: null,
          expires_at: new Date('2025-06-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.storeRefreshToken(tokenData);

      expect(result.used_at).toBeNull();
      expect(result.revoked_at).toBeNull();
    });

    it('should include all required fields in insert query', async () => {
      const tokenData = {
        userId: 'user-789',
        tokenHash: 'hash-789',
        familyId: 'family-789',
        expiresAt: new Date('2025-12-31'),
      };

      const mockResult = {
        rows: [{
          id: 'token-id-3',
          user_id: 'user-789',
          token_hash: 'hash-789',
          family_id: 'family-789',
          used_at: null,
          revoked_at: null,
          expires_at: new Date('2025-12-31'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.storeRefreshToken(tokenData);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        expect.anything()
      );
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('token_hash'),
        expect.anything()
      );
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('family_id'),
        expect.anything()
      );
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('expires_at'),
        expect.anything()
      );
    });
  });

  describe('findByTokenHash', () => {
    it('should find refresh token by hash successfully', async () => {
      const tokenHash = 'existing-hash-123';
      const mockResult = {
        rows: [{
          id: 'token-id-1',
          user_id: 'user-123',
          token_hash: 'existing-hash-123',
          family_id: 'family-abc',
          used_at: null,
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.findByTokenHash(tokenHash);

      expect(result).toBeDefined();
      expect(result.token_hash).toBe('existing-hash-123');
      expect(result.user_id).toBe('user-123');
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [tokenHash]
      );
    });

    it('should return null if token not found', async () => {
      const tokenHash = 'non-existent-hash';
      const mockResult = {
        rows: [],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.findByTokenHash(tokenHash);

      expect(result).toBeNull();
    });

    it('should query with correct WHERE clause', async () => {
      const tokenHash = 'test-hash';
      const mockResult = {
        rows: [],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.findByTokenHash(tokenHash);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1'),
        [tokenHash]
      );
    });

    it('should return all token fields', async () => {
      const mockResult = {
        rows: [{
          id: 'token-id-5',
          user_id: 'user-555',
          token_hash: 'hash-555',
          family_id: 'family-555',
          used_at: new Date('2024-01-15'),
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.findByTokenHash('hash-555');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('token_hash');
      expect(result).toHaveProperty('family_id');
      expect(result).toHaveProperty('used_at');
      expect(result).toHaveProperty('revoked_at');
      expect(result).toHaveProperty('expires_at');
      expect(result).toHaveProperty('created_at');
    });
  });

  describe('markAsUsed', () => {
    it('should mark token as used successfully', async () => {
      const tokenHash = 'token-to-mark';
      const mockResult = {
        rows: [{
          id: 'token-id-1',
          user_id: 'user-123',
          token_hash: 'token-to-mark',
          family_id: 'family-abc',
          used_at: new Date('2024-01-15T10:30:00Z'),
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.markAsUsed(tokenHash);

      expect(result).toBeDefined();
      expect(result.used_at).toBeDefined();
      expect(result.used_at).toBeInstanceOf(Date);
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        [tokenHash]
      );
    });

    it('should set used_at to NOW()', async () => {
      const tokenHash = 'test-token';
      const mockResult = {
        rows: [{
          id: 'token-id-2',
          user_id: 'user-456',
          token_hash: 'test-token',
          family_id: 'family-xyz',
          used_at: new Date(),
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.markAsUsed(tokenHash);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET used_at = NOW()'),
        [tokenHash]
      );
    });

    it('should update only the specified token', async () => {
      const tokenHash = 'specific-token';
      const mockResult = {
        rows: [{
          id: 'token-id-3',
          user_id: 'user-789',
          token_hash: 'specific-token',
          family_id: 'family-123',
          used_at: new Date(),
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.markAsUsed(tokenHash);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1'),
        [tokenHash]
      );
    });

    it('should return updated token record', async () => {
      const tokenHash = 'update-test';
      const mockResult = {
        rows: [{
          id: 'token-id-4',
          user_id: 'user-999',
          token_hash: 'update-test',
          family_id: 'family-999',
          used_at: new Date('2024-01-20'),
          revoked_at: null,
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.markAsUsed(tokenHash);

      expect(result).toEqual(mockResult.rows[0]);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      const tokenHash = 'token-to-revoke';
      const mockResult = {
        rows: [{
          id: 'token-id-1',
          user_id: 'user-123',
          token_hash: 'token-to-revoke',
          family_id: 'family-abc',
          used_at: null,
          revoked_at: new Date('2024-01-15T10:30:00Z'),
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeToken(tokenHash);

      expect(result).toBeDefined();
      expect(result.revoked_at).toBeDefined();
      expect(result.revoked_at).toBeInstanceOf(Date);
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        [tokenHash]
      );
    });

    it('should set revoked_at to NOW()', async () => {
      const tokenHash = 'test-revoke';
      const mockResult = {
        rows: [{
          id: 'token-id-2',
          user_id: 'user-456',
          token_hash: 'test-revoke',
          family_id: 'family-xyz',
          used_at: null,
          revoked_at: new Date(),
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.revokeToken(tokenHash);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET revoked_at = NOW()'),
        [tokenHash]
      );
    });

    it('should return revoked token record', async () => {
      const tokenHash = 'revoke-return-test';
      const mockResult = {
        rows: [{
          id: 'token-id-3',
          user_id: 'user-789',
          token_hash: 'revoke-return-test',
          family_id: 'family-123',
          used_at: null,
          revoked_at: new Date('2024-01-20'),
          expires_at: new Date('2025-01-01'),
          created_at: new Date('2024-01-01'),
        }],
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeToken(tokenHash);

      expect(result).toEqual(mockResult.rows[0]);
      expect(result.revoked_at).toBeDefined();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for a user successfully', async () => {
      const userId = 'user-123';
      const mockResult = {
        rows: [
          { id: 'token-1' },
          { id: 'token-2' },
          { id: 'token-3' },
        ],
        rowCount: 3,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeAllForUser(userId);

      expect(result).toBe(3);
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        [userId]
      );
    });

    it('should only revoke non-revoked tokens', async () => {
      const userId = 'user-456';
      const mockResult = {
        rows: [{ id: 'token-1' }],
        rowCount: 1,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.revokeAllForUser(userId);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND revoked_at IS NULL'),
        [userId]
      );
    });

    it('should return zero if no tokens to revoke', async () => {
      const userId = 'user-no-tokens';
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeAllForUser(userId);

      expect(result).toBe(0);
    });

    it('should return count of revoked tokens', async () => {
      const userId = 'user-multi-tokens';
      const mockResult = {
        rows: [
          { id: 'token-1' },
          { id: 'token-2' },
          { id: 'token-3' },
          { id: 'token-4' },
          { id: 'token-5' },
        ],
        rowCount: 5,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeAllForUser(userId);

      expect(result).toBe(5);
    });

    it('should set revoked_at to NOW()', async () => {
      const userId = 'user-789';
      const mockResult = {
        rows: [{ id: 'token-1' }],
        rowCount: 1,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.revokeAllForUser(userId);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET revoked_at = NOW()'),
        [userId]
      );
    });
  });

  describe('revokeTokenFamily', () => {
    it('should revoke all tokens in a family successfully', async () => {
      const familyId = 'family-123';
      const mockResult = {
        rows: [
          { id: 'token-1' },
          { id: 'token-2' },
        ],
        rowCount: 2,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeTokenFamily(familyId);

      expect(result).toBe(2);
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        [familyId]
      );
    });

    it('should only revoke non-revoked tokens in family', async () => {
      const familyId = 'family-456';
      const mockResult = {
        rows: [{ id: 'token-1' }],
        rowCount: 1,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.revokeTokenFamily(familyId);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE family_id = $1 AND revoked_at IS NULL'),
        [familyId]
      );
    });

    it('should return zero if no tokens to revoke', async () => {
      const familyId = 'family-empty';
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeTokenFamily(familyId);

      expect(result).toBe(0);
    });

    it('should set revoked_at to NOW()', async () => {
      const familyId = 'family-789';
      const mockResult = {
        rows: [{ id: 'token-1' }],
        rowCount: 1,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.revokeTokenFamily(familyId);

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('SET revoked_at = NOW()'),
        [familyId]
      );
    });

    it('should return count of revoked tokens', async () => {
      const familyId = 'family-large';
      const mockResult = {
        rows: [
          { id: 'token-1' },
          { id: 'token-2' },
          { id: 'token-3' },
          { id: 'token-4' },
        ],
        rowCount: 4,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.revokeTokenFamily(familyId);

      expect(result).toBe(4);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired tokens successfully', async () => {
      const mockResult = {
        rows: [
          { id: 'expired-1' },
          { id: 'expired-2' },
          { id: 'expired-3' },
        ],
        rowCount: 3,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.cleanupExpired();

      expect(result).toBe(3);
      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens')
      );
    });

    it('should only delete tokens where expires_at < NOW()', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.cleanupExpired();

      expect(dbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE expires_at < NOW()')
      );
    });

    it('should return zero if no expired tokens', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should return count of deleted tokens', async () => {
      const mockResult = {
        rows: [
          { id: 'expired-1' },
          { id: 'expired-2' },
          { id: 'expired-3' },
          { id: 'expired-4' },
          { id: 'expired-5' },
        ],
        rowCount: 5,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      const result = await refreshTokenQueries.cleanupExpired();

      expect(result).toBe(5);
    });

    it('should use DELETE operation not UPDATE', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      vi.mocked(dbConnection.query).mockResolvedValue(mockResult);

      await refreshTokenQueries.cleanupExpired();

      const query = vi.mocked(dbConnection.query).mock.calls[0][0];
      expect(query).toContain('DELETE');
      expect(query).not.toContain('UPDATE');
    });
  });
});
