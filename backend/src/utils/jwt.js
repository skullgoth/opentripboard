// T030: JWT token generation and verification
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
  console.error('FATAL: JWT_SECRET must be set in production environment');
  process.exit(1);
}

/**
 * Generate access token for authenticated user
 * @param {Object} payload - User data to encode in token
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} [payload.role='user'] - User role
 * @returns {string} JWT access token
 */
export function generateAccessToken(payload) {
  if (!payload.userId || !payload.email) {
    throw new Error('userId and email are required in token payload');
  }

  try {
    const token = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
        type: 'access',
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRY,
        issuer: 'opentripboard-api',
        audience: 'opentripboard-client',
      }
    );

    return token;
  } catch (error) {
    console.error('Token generation failed:', error.message);
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate refresh token for token renewal
 * @param {Object} payload - User data to encode in token
 * @param {string} payload.userId - User ID
 * @param {string} [payload.familyId] - Token family ID (generated if not provided)
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(payload) {
  if (!payload.userId) {
    throw new Error('userId is required in token payload');
  }

  // Generate new family ID if not provided
  const familyId = payload.familyId || randomUUID();

  try {
    const token = jwt.sign(
      {
        userId: payload.userId,
        familyId: familyId,
        type: 'refresh',
      },
      JWT_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRY,
        issuer: 'opentripboard-api',
        audience: 'opentripboard-client',
      }
    );

    return token;
  } catch (error) {
    console.error('Refresh token generation failed:', error.message);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'opentripboard-api',
      audience: 'opentripboard-client',
    });

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      console.error('Token verification failed:', error.message);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Decode a token without verification (for debugging)
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
