import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server.js';

describe('Auth Token Rotation Integration Tests', () => {
  let app;

  beforeAll(async () => {
    // Create Fastify server instance
    app = await createServer();
  });

  afterAll(async () => {
    // Close server
    if (app) {
      await app.close();
    }
  });

  describe('Full Rotation Flow', () => {
    it('should complete full token rotation flow: login -> refresh -> old token fails -> new token works', async () => {
      const testUser = {
        email: `rotation-test-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
        fullName: 'Rotation Test User',
      };

      // Step 1: Register user and get initial tokens
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(registerResponse.statusCode).toBe(201);
      const registerData = JSON.parse(registerResponse.payload);
      expect(registerData).toHaveProperty('accessToken');
      expect(registerData).toHaveProperty('refreshToken');
      expect(registerData).toHaveProperty('user');

      const initialRefreshToken = registerData.refreshToken;
      const initialAccessToken = registerData.accessToken;

      // Step 2: Use refresh token to get new tokens (rotation)
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: initialRefreshToken,
        },
      });

      expect(refreshResponse.statusCode).toBe(200);
      const refreshData = JSON.parse(refreshResponse.payload);
      expect(refreshData).toHaveProperty('accessToken');
      expect(refreshData).toHaveProperty('refreshToken');

      const newRefreshToken = refreshData.refreshToken;
      const newAccessToken = refreshData.accessToken;

      // Verify new refresh token is different from initial token
      expect(newRefreshToken).not.toBe(initialRefreshToken);
      // Note: Access tokens may be identical if generated within the same second
      // This is acceptable as we only need refresh tokens to be unique

      // Step 3: Try to use old refresh token again (should fail with reuse detection)
      const reuseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: initialRefreshToken,
        },
      });

      expect(reuseResponse.statusCode).toBe(401);
      const reuseData = JSON.parse(reuseResponse.payload);
      expect(reuseData.error).toBe('AUTHENTICATION_ERROR');
      expect(reuseData.message).toContain('Token reuse detected');

      // Step 4: Verify new refresh token still works (after reuse detection)
      // Note: The entire token family should be revoked after reuse detection
      const newTokenResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: newRefreshToken,
        },
      });

      // After reuse detection, all tokens in the family should be revoked
      expect(newTokenResponse.statusCode).toBe(401);
      const newTokenData = JSON.parse(newTokenResponse.payload);
      expect(newTokenData.message).toMatch(/revoked|invalid/i);
    });

    it('should allow multiple sequential refreshes with proper rotation', async () => {
      const testUser = {
        email: `multi-refresh-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
        fullName: 'Multi Refresh Test',
      };

      // Register and get initial tokens
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(registerResponse.statusCode).toBe(201);
      let currentRefreshToken = JSON.parse(registerResponse.payload).refreshToken;
      const tokensUsed = [currentRefreshToken];

      // Perform 3 sequential refreshes
      for (let i = 0; i < 3; i++) {
        const refreshResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          payload: {
            refreshToken: currentRefreshToken,
          },
        });

        expect(refreshResponse.statusCode).toBe(200);
        const refreshData = JSON.parse(refreshResponse.payload);

        expect(refreshData).toHaveProperty('accessToken');
        expect(refreshData).toHaveProperty('refreshToken');

        // Verify new token is different
        expect(refreshData.refreshToken).not.toBe(currentRefreshToken);

        // Update current token for next iteration
        currentRefreshToken = refreshData.refreshToken;
        tokensUsed.push(currentRefreshToken);
      }

      // Verify first old token is now invalid (marked as used)
      const firstOldTokenResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: tokensUsed[0],
        },
      });

      expect(firstOldTokenResponse.statusCode).toBe(401);

      // After reuse detection, entire family should be revoked
      // Verify that current token is also revoked
      const finalRefreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: currentRefreshToken,
        },
      });

      expect(finalRefreshResponse.statusCode).toBe(401);
      const finalData = JSON.parse(finalRefreshResponse.payload);
      expect(finalData.message).toMatch(/revoked|reuse/i);
    });
  });

  describe('Logout Functionality', () => {
    it('should successfully logout and revoke refresh token family', async () => {
      const testUser = {
        email: `logout-test-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
        fullName: 'Logout Test User',
      };

      // Register user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(registerResponse.statusCode).toBe(201);
      const { refreshToken, accessToken } = JSON.parse(registerResponse.payload);

      // Logout
      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);
      const logoutData = JSON.parse(logoutResponse.payload);
      expect(logoutData.success).toBe(true);

      // Try to use refresh token after logout (should fail)
      const refreshAfterLogout = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken,
        },
      });

      expect(refreshAfterLogout.statusCode).toBe(401);
    });

    it('should logout from all devices and revoke all refresh tokens', async () => {
      const testUser = {
        email: `logout-all-test-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
        fullName: 'Logout All Test User',
      };

      // Register user (simulates device 1)
      const device1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(device1Response.statusCode).toBe(201);
      const device1Data = JSON.parse(device1Response.payload);

      // Login again to simulate device 2
      const device2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(device2Response.statusCode).toBe(200);
      const device2Data = JSON.parse(device2Response.payload);

      // Logout from all devices using device 1 access token
      const logoutAllResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          authorization: `Bearer ${device1Data.accessToken}`,
        },
      });

      expect(logoutAllResponse.statusCode).toBe(200);
      const logoutAllData = JSON.parse(logoutAllResponse.payload);
      expect(logoutAllData.success).toBe(true);

      // Try to use device 1 refresh token (should fail)
      const device1RefreshAfter = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: device1Data.refreshToken,
        },
      });

      expect(device1RefreshAfter.statusCode).toBe(401);

      // Try to use device 2 refresh token (should also fail)
      const device2RefreshAfter = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: device2Data.refreshToken,
        },
      });

      expect(device2RefreshAfter.statusCode).toBe(401);
    });
  });

  describe('Security - Reuse Detection', () => {
    it('should detect token reuse and revoke entire token family', async () => {
      const testUser = {
        email: `reuse-detection-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
        fullName: 'Reuse Detection Test',
      };

      // Register user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(registerResponse.statusCode).toBe(201);
      const token1 = JSON.parse(registerResponse.payload).refreshToken;

      // First refresh - get token2
      const refresh1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: token1,
        },
      });

      expect(refresh1Response.statusCode).toBe(200);
      const token2 = JSON.parse(refresh1Response.payload).refreshToken;

      // Second refresh - get token3
      const refresh2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: token2,
        },
      });

      expect(refresh2Response.statusCode).toBe(200);
      const token3 = JSON.parse(refresh2Response.payload).refreshToken;

      // Try to reuse token2 (already used) - should trigger family revocation
      const reuseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: token2,
        },
      });

      expect(reuseResponse.statusCode).toBe(401);
      const reuseData = JSON.parse(reuseResponse.payload);
      expect(reuseData.message).toContain('Token reuse detected');

      // Verify token3 (latest valid token) is also revoked due to family revocation
      const token3Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: token3,
        },
      });

      expect(token3Response.statusCode).toBe(401);
      const token3Data = JSON.parse(token3Response.payload);
      expect(token3Data.message).toMatch(/revoked|invalid/i);
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired refresh tokens', async () => {
      // Note: This test would require mocking time or using very short expiration
      // For now, we just verify the error handling path exists
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwidHlwZSI6InJlZnJlc2giLCJleHAiOjF9.test';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: invalidToken,
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Invalid Tokens', () => {
    it('should reject invalid refresh tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('AUTHENTICATION_ERROR');
    });

    it('should reject access tokens used as refresh tokens', async () => {
      const testUser = {
        email: `wrong-token-type-${Date.now()}@test-integration.example`,
        password: 'Test1234!@#$',
      };

      // Register user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(registerResponse.statusCode).toBe(201);
      const { accessToken } = JSON.parse(registerResponse.payload);

      // Try to use access token as refresh token
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: accessToken,
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('AUTHENTICATION_ERROR');
    });
  });
});
