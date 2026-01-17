/**
 * Unit tests for JWT Utility
 * Tests token generation, verification, and extraction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
} from '../../../src/utils/jwt.js';

// Mock console.error to keep test output clean
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('JWT Utility', () => {
  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const token = generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in token', () => {
      const payload = {
        userId: 'user-456',
        email: 'user@test.com',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.userId).toBe('user-456');
      expect(decoded.email).toBe('user@test.com');
      expect(decoded.type).toBe('access');
    });

    it('should include issuer and audience claims', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.iss).toBe('opentripboard-api');
      expect(decoded.aud).toBe('opentripboard-client');
    });

    it('should include expiration time', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should throw error if userId is missing', () => {
      const payload = {
        email: 'test@example.com',
      };

      expect(() => generateAccessToken(payload)).toThrow(
        'userId and email are required in token payload'
      );
    });

    it('should throw error if email is missing', () => {
      const payload = {
        userId: 'user-123',
      };

      expect(() => generateAccessToken(payload)).toThrow(
        'userId and email are required in token payload'
      );
    });

    it('should throw error if payload is empty', () => {
      expect(() => generateAccessToken({})).toThrow(
        'userId and email are required in token payload'
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = {
        userId: 'user-123',
      };

      const token = generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload in token', () => {
      const payload = {
        userId: 'user-789',
      };

      const token = generateRefreshToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.userId).toBe('user-789');
      expect(decoded.type).toBe('refresh');
      expect(decoded.email).toBeUndefined(); // Refresh token doesn't include email
    });

    it('should include issuer and audience claims', () => {
      const payload = {
        userId: 'user-123',
      };

      const token = generateRefreshToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.iss).toBe('opentripboard-api');
      expect(decoded.aud).toBe('opentripboard-client');
    });

    it('should throw error if userId is missing', () => {
      const payload = {};

      expect(() => generateRefreshToken(payload)).toThrow(
        'userId is required in token payload'
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded access token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };
      const token = generateAccessToken(payload);

      const decoded = verifyToken(token);

      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
    });

    it('should verify and return decoded refresh token', () => {
      const payload = {
        userId: 'user-456',
      };
      const token = generateRefreshToken(payload);

      const decoded = verifyToken(token);

      expect(decoded.userId).toBe('user-456');
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyToken('not.a.valid.jwt')).toThrow('Invalid token');
    });

    it('should throw error for token with wrong secret', () => {
      // Create token with different secret
      const wrongToken = jwt.sign(
        { userId: 'user-123', type: 'access' },
        'wrong-secret',
        { issuer: 'opentripboard-api', audience: 'opentripboard-client' }
      );

      expect(() => verifyToken(wrongToken)).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        {
          expiresIn: '-1s', // Already expired
          issuer: 'opentripboard-api',
          audience: 'opentripboard-client',
        }
      );

      expect(() => verifyToken(expiredToken)).toThrow('Token has expired');
    });

    it('should throw error for token with wrong issuer', () => {
      const wrongIssuerToken = jwt.sign(
        { userId: 'user-123', type: 'access' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { issuer: 'wrong-issuer', audience: 'opentripboard-client' }
      );

      expect(() => verifyToken(wrongIssuerToken)).toThrow('Invalid token');
    });

    it('should throw error for token with wrong audience', () => {
      const wrongAudienceToken = jwt.sign(
        { userId: 'user-123', type: 'access' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { issuer: 'opentripboard-api', audience: 'wrong-audience' }
      );

      expect(() => verifyToken(wrongAudienceToken)).toThrow('Invalid token');
    });

    it('should throw error for null token', () => {
      expect(() => verifyToken(null)).toThrow('Token is required');
    });

    it('should throw error for undefined token', () => {
      expect(() => verifyToken(undefined)).toThrow('Token is required');
    });

    it('should throw error for non-string token', () => {
      expect(() => verifyToken(12345)).toThrow('Token is required');
    });

    it('should throw error for empty string token', () => {
      expect(() => verifyToken('')).toThrow('Token is required');
    });
  });

  describe('decodeToken', () => {
    it('should decode valid token without verification', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };
      const token = generateAccessToken(payload);

      const decoded = decodeToken(token);

      expect(decoded.userId).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should decode token with wrong secret (no verification)', () => {
      const wrongToken = jwt.sign(
        { userId: 'user-123', type: 'access' },
        'wrong-secret'
      );

      const decoded = decodeToken(wrongToken);

      expect(decoded.userId).toBe('user-123');
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('not-a-token');

      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const decoded = decodeToken('a.b');

      // jwt.decode returns null for malformed tokens
      expect(decoded).toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractTokenFromHeader('Bearer my-token-123');

      expect(token).toBe('my-token-123');
    });

    it('should extract token with special characters', () => {
      const token = extractTokenFromHeader('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');

      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
    });

    it('should return null for null header', () => {
      const token = extractTokenFromHeader(null);

      expect(token).toBeNull();
    });

    it('should return null for undefined header', () => {
      const token = extractTokenFromHeader(undefined);

      expect(token).toBeNull();
    });

    it('should return null for non-string header', () => {
      const token = extractTokenFromHeader(12345);

      expect(token).toBeNull();
    });

    it('should return null for empty string', () => {
      const token = extractTokenFromHeader('');

      expect(token).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const token = extractTokenFromHeader('Basic my-token');

      expect(token).toBeNull();
    });

    it('should return null for header with only Bearer', () => {
      const token = extractTokenFromHeader('Bearer');

      expect(token).toBeNull();
    });

    it('should return null for header with extra parts', () => {
      const token = extractTokenFromHeader('Bearer token extra');

      expect(token).toBeNull();
    });

    it('should return null for lowercase bearer', () => {
      const token = extractTokenFromHeader('bearer my-token');

      expect(token).toBeNull();
    });

    it('should handle token with spaces in value (invalid)', () => {
      // This is technically invalid but tests the split behavior
      const token = extractTokenFromHeader('Bearer token with spaces');

      expect(token).toBeNull();
    });
  });
});
