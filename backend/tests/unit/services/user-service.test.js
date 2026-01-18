/**
 * Comprehensive Unit tests for User Service
 * Tests all user-related business logic including registration, authentication, profile, and token refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as userService from '../../../src/services/user-service.js';
import * as userQueries from '../../../src/db/queries/users.js';
import * as refreshTokenQueries from '../../../src/db/queries/refresh-tokens.js';
import * as crypto from '../../../src/utils/crypto.js';
import * as jwt from '../../../src/utils/jwt.js';
import { createMockUser } from '../../helpers.js';

// Mock the database connection, queries and utilities
vi.mock('../../../src/db/connection.js', () => ({
  getPool: vi.fn(),
  query: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock('../../../src/db/queries/users.js');
vi.mock('../../../src/db/queries/refresh-tokens.js');
vi.mock('../../../src/utils/crypto.js');
vi.mock('../../../src/utils/jwt.js');

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    const validUserData = {
      email: 'newuser@example.com',
      password: 'StrongPass123',
      fullName: 'New User',
    };

    it('should register a new user successfully', async () => {
      const mockUser = createMockUser({ email: validUserData.email });
      const mockToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(crypto.hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue(mockToken);
      vi.mocked(jwt.generateRefreshToken).mockReturnValue(mockRefreshToken);

      const result = await userService.register(validUserData);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(validUserData.email);
      expect(result.accessToken).toBe(mockToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(userQueries.createUser).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid email format', async () => {
      const invalidEmailData = { ...validUserData, email: 'invalid-email' };

      await expect(userService.register(invalidEmailData))
        .rejects
        .toThrow('Invalid email format');
    });

    it('should throw ValidationError for email without @ symbol', async () => {
      const invalidEmailData = { ...validUserData, email: 'invalidemail.com' };

      await expect(userService.register(invalidEmailData))
        .rejects
        .toThrow('Invalid email format');
    });

    it('should throw ValidationError for email without domain', async () => {
      const invalidEmailData = { ...validUserData, email: 'user@' };

      await expect(userService.register(invalidEmailData))
        .rejects
        .toThrow('Invalid email format');
    });

    it('should throw ValidationError for weak password', async () => {
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long']
      });

      await expect(userService.register(validUserData))
        .rejects
        .toThrow('Password does not meet requirements');
    });

    it('should throw ConflictError if user already exists', async () => {
      const existingUser = createMockUser({ email: validUserData.email });

      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(userQueries.findByEmail).mockResolvedValue(existingUser);

      await expect(userService.register(validUserData))
        .rejects
        .toThrow('User with this email already exists');
    });

    it('should register user without fullName (optional)', async () => {
      const userDataWithoutName = {
        email: 'test@example.com',
        password: 'StrongPass123',
      };
      const mockUser = createMockUser({ email: userDataWithoutName.email, full_name: null });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(crypto.hashPassword).mockResolvedValue('hashed-password');
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      const result = await userService.register(userDataWithoutName);

      expect(result.user).toBeDefined();
      expect(userQueries.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: null })
      );
    });

    it('should hash password before storing', async () => {
      const mockUser = createMockUser({ email: validUserData.email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(crypto.hashPassword).mockResolvedValue('hashed-password-xyz');
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      await userService.register(validUserData);

      expect(crypto.hashPassword).toHaveBeenCalledWith(validUserData.password);
      expect(userQueries.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed-password-xyz' })
      );
    });

    it('should generate both access and refresh tokens', async () => {
      const mockUser = createMockUser({ email: validUserData.email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(crypto.hashPassword).mockResolvedValue('hashed');
      vi.mocked(crypto.hashToken).mockResolvedValue('token-hash');
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('access-token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh-token');
      vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

      const result = await userService.register(validUserData);

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        role: 'user'
      });
      expect(jwt.generateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          familyId: expect.any(String)
        })
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should return formatted user object without password', async () => {
      const mockUser = createMockUser({
        email: validUserData.email,
        full_name: 'New User',
        created_at: new Date('2024-01-01')
      });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(crypto.validatePasswordStrength).mockReturnValue({
        isValid: true,
        errors: []
      });
      vi.mocked(crypto.hashPassword).mockResolvedValue('hashed');
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      const result = await userService.register(validUserData);

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.full_name,
        createdAt: mockUser.created_at,
        role: 'user'
      });
      expect(result.user.password_hash).toBeUndefined();
    });
  });

  describe('authenticate', () => {
    const email = 'test@example.com';
    const password = 'Password123';

    it('should authenticate a user successfully', async () => {
      const mockUser = createMockUser({ email });
      const mockToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue(mockToken);
      vi.mocked(jwt.generateRefreshToken).mockReturnValue(mockRefreshToken);

      const result = await userService.authenticate(email, password);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.accessToken).toBe(mockToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(crypto.verifyPassword).toHaveBeenCalledWith(password, mockUser.password_hash);
    });

    it('should throw AuthenticationError if user not found', async () => {
      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);

      await expect(userService.authenticate(email, password))
        .rejects
        .toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for incorrect password', async () => {
      const mockUser = createMockUser({ email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);

      await expect(userService.authenticate(email, password))
        .rejects
        .toThrow('Invalid email or password');
    });

    it('should not reveal whether email or password is wrong', async () => {
      // Test that error message is the same for both cases (security)
      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);

      try {
        await userService.authenticate(email, password);
      } catch (error) {
        expect(error.message).toBe('Invalid email or password');
      }

      const mockUser = createMockUser({ email });
      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);

      try {
        await userService.authenticate(email, 'wrongpassword');
      } catch (error) {
        expect(error.message).toBe('Invalid email or password');
      }
    });

    it('should generate tokens with correct payload', async () => {
      const mockUser = createMockUser({ email, id: 'user-456' });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(crypto.hashToken).mockResolvedValue('token-hash');
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');
      vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

      await userService.authenticate(email, password);

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: 'user-456',
        email: email,
        role: 'user'
      });
      expect(jwt.generateRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          familyId: expect.any(String)
        })
      );
    });

    it('should return formatted user object', async () => {
      const mockUser = createMockUser({
        id: 'user-789',
        email,
        full_name: 'Test User',
        created_at: new Date('2024-06-01')
      });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      const result = await userService.authenticate(email, password);

      expect(result.user).toEqual({
        id: 'user-789',
        email,
        fullName: 'Test User',
        createdAt: mockUser.created_at,
        role: 'user'
      });
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId });

      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);

      const result = await userService.getProfile(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.email).toBe(mockUser.email);
      expect(userQueries.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw AuthenticationError if user not found', async () => {
      const userId = 'non-existent-user';

      vi.mocked(userQueries.findById).mockResolvedValue(null);

      await expect(userService.getProfile(userId))
        .rejects
        .toThrow('User not found');
    });

    it('should return formatted profile without sensitive data', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'profile@example.com',
        full_name: 'Profile User',
        password_hash: 'should-not-be-returned',
        created_at: new Date('2024-01-15')
      });

      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);

      const result = await userService.getProfile('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'profile@example.com',
        fullName: 'Profile User',
        createdAt: mockUser.created_at,
        role: 'user'
      });
      expect(result.password_hash).toBeUndefined();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenHash = 'hashed-token';
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId });
      const mockAccessToken = 'new-access-token';
      const mockStoredToken = {
        id: 'token-id',
        user_id: userId,
        token_hash: tokenHash,
        family_id: 'family-123',
        used_at: null,
        revoked_at: null,
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date(),
      };

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId,
        type: 'refresh'
      });
      vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
      vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
      vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
      vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

      const result = await userService.refreshAccessToken(refreshToken);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe(mockAccessToken);
      expect(jwt.verifyToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should throw AuthenticationError for invalid token type', async () => {
      const refreshToken = 'access-token-not-refresh';

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-123',
        type: 'access' // Wrong type
      });

      await expect(userService.refreshAccessToken(refreshToken))
        .rejects
        .toThrow('Invalid token type');
    });

    it('should throw AuthenticationError if user no longer exists', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenHash = 'hashed-token';
      const mockStoredToken = {
        id: 'token-id',
        user_id: 'deleted-user',
        token_hash: tokenHash,
        family_id: 'family-123',
        used_at: null,
        revoked_at: null,
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date(),
      };

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'deleted-user',
        type: 'refresh'
      });
      vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
      vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
      vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
      vi.mocked(userQueries.findById).mockResolvedValue(null);

      await expect(userService.refreshAccessToken(refreshToken))
        .rejects
        .toThrow('User not found');
    });

    it('should throw AuthenticationError for expired token', async () => {
      const expiredToken = 'expired-refresh-token';

      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Token has expired');
      });

      await expect(userService.refreshAccessToken(expiredToken))
        .rejects
        .toThrow('Invalid refresh token');
    });

    it('should throw AuthenticationError for malformed token', async () => {
      const malformedToken = 'malformed-token';

      vi.mocked(jwt.verifyToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(userService.refreshAccessToken(malformedToken))
        .rejects
        .toThrow('Invalid refresh token');
    });

    it('should generate new access token with correct user data', async () => {
      const tokenHash = 'hashed-token';
      const mockUser = createMockUser({
        id: 'user-456',
        email: 'refresh@example.com'
      });
      const mockStoredToken = {
        id: 'token-id',
        user_id: 'user-456',
        token_hash: tokenHash,
        family_id: 'family-123',
        used_at: null,
        revoked_at: null,
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date(),
      };

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-456',
        type: 'refresh'
      });
      vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
      vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
      vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('new-token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
      vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

      await userService.refreshAccessToken('valid-token');

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: 'user-456',
        email: 'refresh@example.com',
        role: 'user'
      });
    });

    describe('Token Rotation', () => {
      it('should return both new access token and new refresh token', async () => {
        const refreshToken = 'valid-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const userId = 'user-123';
        const mockUser = createMockUser({ id: userId });
        const mockStoredToken = {
          id: 'token-id',
          user_id: userId,
          token_hash: tokenHash,
          family_id: familyId,
          used_at: null,
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000), // Future date
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId,
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
        vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
        vi.mocked(jwt.generateAccessToken).mockReturnValue('new-access-token');
        vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
        vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

        const result = await userService.refreshAccessToken(refreshToken);

        expect(result).toBeDefined();
        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBe('new-refresh-token');
      });

      it('should mark old refresh token as used', async () => {
        const refreshToken = 'valid-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const userId = 'user-123';
        const mockUser = createMockUser({ id: userId });
        const mockStoredToken = {
          id: 'token-id',
          user_id: userId,
          token_hash: tokenHash,
          family_id: familyId,
          used_at: null,
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId,
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
        vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
        vi.mocked(jwt.generateAccessToken).mockReturnValue('new-access-token');
        vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
        vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

        await userService.refreshAccessToken(refreshToken);

        expect(refreshTokenQueries.markAsUsed).toHaveBeenCalledWith(tokenHash);
      });

      it('should generate new refresh token with same family ID for rotation tracking', async () => {
        const refreshToken = 'valid-refresh-token';
        const tokenHash = 'hashed-token';
        const newTokenHash = 'new-hashed-token';
        const familyId = 'family-123';
        const userId = 'user-123';
        const mockUser = createMockUser({ id: userId, email: 'user@example.com' });
        const mockStoredToken = {
          id: 'token-id',
          user_id: userId,
          token_hash: tokenHash,
          family_id: familyId,
          used_at: null,
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId,
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken)
          .mockResolvedValueOnce(tokenHash)  // First call for old token
          .mockResolvedValueOnce(newTokenHash); // Second call for new token
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
        vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
        vi.mocked(jwt.generateAccessToken).mockReturnValue('new-access-token');
        vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
        vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

        await userService.refreshAccessToken(refreshToken);

        // Verify new refresh token is generated with same family ID
        expect(jwt.generateRefreshToken).toHaveBeenCalledWith({
          userId,
          familyId
        });

        // Verify new token is stored with same family ID
        expect(refreshTokenQueries.storeRefreshToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId,
            familyId,
            tokenHash: newTokenHash
          })
        );
      });

      it('should store new refresh token in database with 7-day expiration', async () => {
        const refreshToken = 'valid-refresh-token';
        const tokenHash = 'hashed-token';
        const newTokenHash = 'new-hashed-token';
        const familyId = 'family-123';
        const userId = 'user-123';
        const mockUser = createMockUser({ id: userId });
        const mockStoredToken = {
          id: 'token-id',
          user_id: userId,
          token_hash: tokenHash,
          family_id: familyId,
          used_at: null,
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId,
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken)
          .mockResolvedValueOnce(tokenHash)
          .mockResolvedValueOnce(newTokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.markAsUsed).mockResolvedValue({});
        vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
        vi.mocked(jwt.generateAccessToken).mockReturnValue('new-access-token');
        vi.mocked(jwt.generateRefreshToken).mockReturnValue('new-refresh-token');
        vi.mocked(refreshTokenQueries.storeRefreshToken).mockResolvedValue({});

        const beforeCall = Date.now();
        await userService.refreshAccessToken(refreshToken);
        const afterCall = Date.now();

        expect(refreshTokenQueries.storeRefreshToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId,
            tokenHash: newTokenHash,
            familyId
          })
        );

        // Verify expiration is approximately 7 days from now
        const storeCall = vi.mocked(refreshTokenQueries.storeRefreshToken).mock.calls[0][0];
        const expiresAt = storeCall.expiresAt.getTime();
        const expectedExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + expectedExpiry);
        expect(expiresAt).toBeLessThanOrEqual(afterCall + expectedExpiry);
      });
    });

    describe('Token Validation', () => {
      it('should verify token exists in database', async () => {
        const refreshToken = 'valid-refresh-token';
        const tokenHash = 'hashed-token';

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(null); // Not found

        await expect(userService.refreshAccessToken(refreshToken))
          .rejects
          .toThrow('Invalid refresh token');

        expect(refreshTokenQueries.findByTokenHash).toHaveBeenCalledWith(tokenHash);
      });

      it('should check if token is expired', async () => {
        const refreshToken = 'expired-refresh-token';
        const tokenHash = 'hashed-token';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: 'family-123',
          used_at: null,
          revoked_at: null,
          expires_at: new Date(Date.now() - 86400000), // Past date (expired)
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);

        await expect(userService.refreshAccessToken(refreshToken))
          .rejects
          .toThrow('Refresh token expired');
      });

      it('should check if token is revoked', async () => {
        const refreshToken = 'revoked-refresh-token';
        const tokenHash = 'hashed-token';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: 'family-123',
          used_at: null,
          revoked_at: new Date(), // Token is revoked
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);

        await expect(userService.refreshAccessToken(refreshToken))
          .rejects
          .toThrow('Refresh token revoked');
      });
    });

    describe('Reuse Detection', () => {
      it('should detect token reuse and throw error', async () => {
        const refreshToken = 'used-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: familyId,
          used_at: new Date(), // Token already used
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.revokeTokenFamily).mockResolvedValue(2); // Returns count

        await expect(userService.refreshAccessToken(refreshToken))
          .rejects
          .toThrow('Token reuse detected');
      });

      it('should revoke entire token family when reuse is detected', async () => {
        const refreshToken = 'used-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: familyId,
          used_at: new Date(), // Token already used
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.revokeTokenFamily).mockResolvedValue(2);

        try {
          await userService.refreshAccessToken(refreshToken);
        } catch (error) {
          // Expected to throw
        }

        expect(refreshTokenQueries.revokeTokenFamily).toHaveBeenCalledWith(familyId);
      });

      it('should not mark token as used if reuse is detected', async () => {
        const refreshToken = 'used-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: familyId,
          used_at: new Date(), // Token already used
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.revokeTokenFamily).mockResolvedValue(2);

        try {
          await userService.refreshAccessToken(refreshToken);
        } catch (error) {
          // Expected to throw
        }

        // Should NOT call markAsUsed since reuse was detected
        expect(refreshTokenQueries.markAsUsed).not.toHaveBeenCalled();
      });

      it('should not generate new tokens if reuse is detected', async () => {
        const refreshToken = 'used-refresh-token';
        const tokenHash = 'hashed-token';
        const familyId = 'family-123';
        const mockStoredToken = {
          id: 'token-id',
          user_id: 'user-123',
          token_hash: tokenHash,
          family_id: familyId,
          used_at: new Date(), // Token already used
          revoked_at: null,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        };

        vi.mocked(jwt.verifyToken).mockReturnValue({
          userId: 'user-123',
          type: 'refresh'
        });
        vi.mocked(crypto.hashToken).mockResolvedValue(tokenHash);
        vi.mocked(refreshTokenQueries.findByTokenHash).mockResolvedValue(mockStoredToken);
        vi.mocked(refreshTokenQueries.revokeTokenFamily).mockResolvedValue(2);

        try {
          await userService.refreshAccessToken(refreshToken);
        } catch (error) {
          // Expected to throw
        }

        // Should NOT generate new tokens since reuse was detected
        expect(jwt.generateAccessToken).not.toHaveBeenCalled();
        expect(jwt.generateRefreshToken).not.toHaveBeenCalled();
        expect(refreshTokenQueries.storeRefreshToken).not.toHaveBeenCalled();
      });
    });
  });
});
