// T064: UserService - register, authenticate, password handling
// US8: Extended with role support and admin bootstrapping
import {
  createUser,
  findByEmail,
  findById,
  countAdmins,
  isAccountLocked,
  incrementFailedAttempts,
  resetFailedAttempts,
  lockAccount,
} from '../db/queries/users.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/crypto.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { ConflictError, AuthenticationError, ValidationError } from '../middleware/error-handler.js';

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
  const refreshToken = generateRefreshToken({ userId: user.id });

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

  // Check if account is locked
  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.isLocked) {
    const lockedUntil = new Date(lockStatus.lockedUntil);
    const now = new Date();
    const minutesRemaining = Math.ceil((lockedUntil - now) / 1000 / 60);
    throw new AuthenticationError(
      `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    // Increment failed attempts
    const updatedUser = await incrementFailedAttempts(user.id);

    // Lock account after 5 failed attempts (lockout duration: 15 minutes)
    const FAILED_ATTEMPTS_THRESHOLD = 5;
    const LOCKOUT_DURATION_MINUTES = 15;

    if (updatedUser.failed_login_attempts >= FAILED_ATTEMPTS_THRESHOLD) {
      await lockAccount(user.id, LOCKOUT_DURATION_MINUTES);
      throw new AuthenticationError(
        `Account locked due to ${FAILED_ATTEMPTS_THRESHOLD} failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`
      );
    }

    throw new AuthenticationError('Invalid email or password');
  }

  // Reset failed attempts on successful login
  await resetFailedAttempts(user.id);

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role || 'user' });
  const refreshToken = generateRefreshToken({ userId: user.id });

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
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token
 */
export async function refreshAccessToken(refreshToken) {
  // This would typically verify the refresh token and generate a new access token
  // For now, returning a simple implementation
  const { verifyToken } = await import('../utils/jwt.js');

  try {
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    const user = await findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role || 'user' });

    return { accessToken };
  } catch (error) {
    throw new AuthenticationError('Invalid refresh token');
  }
}
