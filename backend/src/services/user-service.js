// T064: UserService - register, authenticate, password handling
// US8: Extended with role support and admin bootstrapping
// T013: Extended with refresh token storage and rotation
import { createUser, findByEmail, findById, countAdmins } from '../db/queries/users.js';
import { hashPassword, verifyPassword, validatePasswordStrength, hashToken } from '../utils/crypto.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { ConflictError, AuthenticationError, ValidationError } from '../middleware/error-handler.js';
import { storeRefreshToken, findByTokenHash, markAsUsed, revokeTokenFamily } from '../db/queries/refresh-tokens.js';
import { randomUUID } from 'crypto';

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - Plain text password
 * @param {string} userData.fullName - User's full name
 * @returns {Promise<Object>} Created user and tokens
 */
export async function register({ email, password, fullName }) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
  }

  // Check if user already exists
  const existingUser = await findByEmail(email);
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // US8: Auto-promote first user to admin if no admins exist (bootstrapping)
  let role = 'user';
  const adminCount = await countAdmins();
  if (adminCount === 0) {
    role = 'admin';
  }

  // Create user
  const user = await createUser({
    email,
    passwordHash,
    fullName: fullName || null,
    role,
  });

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role || 'user' });
  const familyId = randomUUID();
  const refreshToken = generateRefreshToken({ userId: user.id, familyId });

  // Store refresh token in database
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role || 'user',
      createdAt: user.created_at,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Authenticate a user
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} User and tokens
 */
export async function authenticate(email, password) {
  // Find user
  const user = await findByEmail(email);
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role || 'user' });
  const familyId = randomUUID();
  const refreshToken = generateRefreshToken({ userId: user.id, familyId });

  // Store refresh token in database
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await storeRefreshToken({
    userId: user.id,
    tokenHash,
    familyId,
    expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role || 'user',
      createdAt: user.created_at,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Get user profile by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile
 */
export async function getProfile(userId) {
  const user = await findById(userId);
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role || 'user',
    createdAt: user.created_at,
  };
}

/**
 * Refresh access token with token rotation
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token and refresh token
 */
export async function refreshAccessToken(refreshToken) {
  const { verifyToken } = await import('../utils/jwt.js');

  try {
    // Verify JWT signature and decode
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    // Hash the token to look it up in database
    const tokenHash = await hashToken(refreshToken);

    // Find token in database
    const storedToken = await findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if token is expired
    if (new Date(storedToken.expires_at) < new Date()) {
      throw new AuthenticationError('Refresh token expired');
    }

    // Check if token is revoked
    if (storedToken.revoked_at) {
      throw new AuthenticationError('Refresh token revoked');
    }

    // Check if token has already been used (reuse detection)
    if (storedToken.used_at) {
      // Token reuse detected - revoke entire token family for security
      await revokeTokenFamily(storedToken.family_id);
      throw new AuthenticationError('Token reuse detected');
    }

    // Mark current token as used
    await markAsUsed(tokenHash);

    // Get user
    const user = await findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Generate new tokens with same familyId (rotation)
    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role || 'user' });
    const newRefreshToken = generateRefreshToken({ userId: user.id, familyId: storedToken.family_id });

    // Store new refresh token
    const newTokenHash = await hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await storeRefreshToken({
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: storedToken.family_id,
      expiresAt,
    });

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid refresh token');
  }
}
