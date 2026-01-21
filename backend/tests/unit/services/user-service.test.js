/**
 * Comprehensive Unit tests for User Service
 * Tests all user-related business logic including registration, authentication, profile, and token refresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as userService from '../../../src/services/user-service.js';
import * as userQueries from '../../../src/db/queries/users.js';
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
      vi.mocked(userQueries.createUser).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('access-token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh-token');

      const result = await userService.register(validUserData);

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        role: 'user'
      });
      expect(jwt.generateRefreshToken).toHaveBeenCalledWith({
        userId: mockUser.id
      });
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
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
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
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValue({
        id: mockUser.id,
        failed_login_attempts: 1,
        last_failed_login_at: new Date(),
      });

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
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValue({
        id: mockUser.id,
        failed_login_attempts: 1,
        last_failed_login_at: new Date(),
      });

      try {
        await userService.authenticate(email, 'wrongpassword');
      } catch (error) {
        expect(error.message).toBe('Invalid email or password');
      }
    });

    it('should generate tokens with correct payload', async () => {
      const mockUser = createMockUser({ email, id: 'user-456' });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      await userService.authenticate(email, password);

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: 'user-456',
        email: email,
        role: 'user'
      });
      expect(jwt.generateRefreshToken).toHaveBeenCalledWith({
        userId: 'user-456'
      });
    });

    it('should return formatted user object', async () => {
      const mockUser = createMockUser({
        id: 'user-789',
        email,
        full_name: 'Test User',
        created_at: new Date('2024-06-01')
      });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
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
      const userId = 'user-123';
      const mockUser = createMockUser({ id: userId });
      const mockAccessToken = 'new-access-token';

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId,
        type: 'refresh'
      });
      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue(mockAccessToken);

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
        .toThrow('Invalid refresh token');
    });

    it('should throw AuthenticationError if user no longer exists', async () => {
      const refreshToken = 'valid-refresh-token';

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'deleted-user',
        type: 'refresh'
      });
      vi.mocked(userQueries.findById).mockResolvedValue(null);

      await expect(userService.refreshAccessToken(refreshToken))
        .rejects
        .toThrow('Invalid refresh token');
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
      const mockUser = createMockUser({
        id: 'user-456',
        email: 'refresh@example.com'
      });

      vi.mocked(jwt.verifyToken).mockReturnValue({
        userId: 'user-456',
        type: 'refresh'
      });
      vi.mocked(userQueries.findById).mockResolvedValue(mockUser);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('new-token');

      await userService.refreshAccessToken('valid-token');

      expect(jwt.generateAccessToken).toHaveBeenCalledWith({
        userId: 'user-456',
        email: 'refresh@example.com',
        role: 'user'
      });
    });
  });

  describe('Account Lockout', () => {
    const email = 'lockout@example.com';
    const password = 'Password123';
    const wrongPassword = 'WrongPassword';
    const userId = 'user-lockout-123';

    it('should lock account after 5 failed login attempts', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);

      // Mock incrementFailedAttempts to return increasing attempt counts
      for (let i = 1; i <= 5; i++) {
        vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValueOnce({
          id: userId,
          failed_login_attempts: i,
          last_failed_login_at: new Date(),
        });

        try {
          await userService.authenticate(email, wrongPassword);
        } catch (error) {
          // Expected to throw
          if (i === 5) {
            // On 5th failed attempt, account should be locked
            expect(error.message).toContain('Account locked due to 5 failed login attempts');
            expect(error.message).toContain('15 minutes');
            expect(userQueries.lockAccount).toHaveBeenCalledWith(userId, 15);
          } else {
            expect(error.message).toBe('Invalid email or password');
          }
        }
      }

      expect(userQueries.incrementFailedAttempts).toHaveBeenCalledTimes(5);
    });

    it('should reject login for locked account with time remaining message', async () => {
      const mockUser = createMockUser({ id: userId, email });
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Locked for 10 more minutes

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({
        isLocked: true,
        lockedUntil: lockedUntil.toISOString(),
      });

      await expect(userService.authenticate(email, password))
        .rejects
        .toThrow(/Account is locked due to multiple failed login attempts/);

      // Verify password was not checked (account check happens first)
      expect(crypto.verifyPassword).not.toHaveBeenCalled();
    });

    it('should include correct time remaining in lockout error message', async () => {
      const mockUser = createMockUser({ id: userId, email });
      const lockedUntil = new Date(Date.now() + 7.5 * 60 * 1000); // 7.5 minutes remaining

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({
        isLocked: true,
        lockedUntil: lockedUntil.toISOString(),
      });

      try {
        await userService.authenticate(email, password);
        throw new Error('Should have thrown AuthenticationError');
      } catch (error) {
        expect(error.message).toMatch(/try again in 8 minutes/); // Ceiling of 7.5 = 8
      }
    });

    it('should reset failed attempts counter on successful login', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');
      vi.mocked(userQueries.resetFailedAttempts).mockResolvedValue({
        id: userId,
        failed_login_attempts: 0,
        locked_until: null,
      });

      await userService.authenticate(email, password);

      expect(userQueries.resetFailedAttempts).toHaveBeenCalledWith(userId);
    });

    it('should allow login when account is not locked', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      const result = await userService.authenticate(email, password);

      expect(result).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.accessToken).toBe('token');
    });

    it('should increment failed attempts on each wrong password', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValue({
        id: userId,
        failed_login_attempts: 1,
        last_failed_login_at: new Date(),
      });

      try {
        await userService.authenticate(email, wrongPassword);
      } catch (error) {
        // Expected to throw
      }

      expect(userQueries.incrementFailedAttempts).toHaveBeenCalledWith(userId);
    });

    it('should track failed attempts per account not globally', async () => {
      const user1 = createMockUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createMockUser({ id: 'user-2', email: 'user2@example.com' });

      // User 1 fails login
      vi.mocked(userQueries.findByEmail).mockResolvedValueOnce(user1);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValueOnce({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValueOnce(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValueOnce({
        id: 'user-1',
        failed_login_attempts: 1,
        last_failed_login_at: new Date(),
      });

      try {
        await userService.authenticate('user1@example.com', wrongPassword);
      } catch (error) {
        // Expected
      }

      // User 2 fails login
      vi.mocked(userQueries.findByEmail).mockResolvedValueOnce(user2);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValueOnce({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValueOnce(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValueOnce({
        id: 'user-2',
        failed_login_attempts: 1,
        last_failed_login_at: new Date(),
      });

      try {
        await userService.authenticate('user2@example.com', wrongPassword);
      } catch (error) {
        // Expected
      }

      // Verify that incrementFailedAttempts was called with different user IDs
      expect(userQueries.incrementFailedAttempts).toHaveBeenCalledWith('user-1');
      expect(userQueries.incrementFailedAttempts).toHaveBeenCalledWith('user-2');
    });

    it('should not increment failed attempts on successful login', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(true);
      vi.mocked(jwt.generateAccessToken).mockReturnValue('token');
      vi.mocked(jwt.generateRefreshToken).mockReturnValue('refresh');

      await userService.authenticate(email, password);

      expect(userQueries.incrementFailedAttempts).not.toHaveBeenCalled();
    });

    it('should lock account for exactly 15 minutes after threshold', async () => {
      const mockUser = createMockUser({ id: userId, email });

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({ isLocked: false, lockedUntil: null });
      vi.mocked(crypto.verifyPassword).mockResolvedValue(false);
      vi.mocked(userQueries.incrementFailedAttempts).mockResolvedValue({
        id: userId,
        failed_login_attempts: 5,
        last_failed_login_at: new Date(),
      });

      try {
        await userService.authenticate(email, wrongPassword);
      } catch (error) {
        // Expected to throw
      }

      expect(userQueries.lockAccount).toHaveBeenCalledWith(userId, 15);
    });

    it('should check account lock status before password verification', async () => {
      const mockUser = createMockUser({ id: userId, email });
      const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);

      vi.mocked(userQueries.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(userQueries.isAccountLocked).mockResolvedValue({
        isLocked: true,
        lockedUntil: lockedUntil.toISOString(),
      });

      try {
        await userService.authenticate(email, password);
      } catch (error) {
        // Expected to throw lockout error
      }

      // Password verification should not be called if account is locked
      expect(crypto.verifyPassword).not.toHaveBeenCalled();
      expect(userQueries.incrementFailedAttempts).not.toHaveBeenCalled();
    });
  });
});
