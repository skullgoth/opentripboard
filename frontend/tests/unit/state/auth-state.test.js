/**
 * Unit tests for Auth State Management
 * Tests singleton state from src/state/auth-state.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../src/utils/api-client.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('../../../src/utils/storage.js', () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
}));

let authState;
let apiClient;
let storage;

describe('Auth State', () => {
  beforeEach(async () => {
    vi.resetModules();

    // Re-mock after reset
    vi.mock('../../../src/utils/api-client.js', () => ({
      apiClient: {
        post: vi.fn(),
      },
    }));

    vi.mock('../../../src/utils/storage.js', () => ({
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }));

    // Dynamic import to get fresh singleton
    const authModule = await import('../../../src/state/auth-state.js');
    authState = authModule.authState;

    const apiModule = await import('../../../src/utils/api-client.js');
    apiClient = apiModule.apiClient;

    const storageModule = await import('../../../src/utils/storage.js');
    storage = storageModule;
  });

  // ─── loadFromStorage ──────────────────────────────────────
  describe('loadFromStorage', () => {
    it('should not set token/user when storage returns null', () => {
      expect(authState.isAuthenticated()).toBe(false);
      expect(authState.getCurrentUser()).toBeNull();
    });

    it('should load token and user from storage when both exist', () => {
      const mockUser = { id: 'u1', email: 'test@test.com', role: 'user' };

      // Configure storage mock to return values
      storage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'mock-token';
        if (key === 'user') return mockUser;
        return null;
      });

      // Call loadFromStorage which reads from the mocked storage
      authState.loadFromStorage();

      expect(authState.isAuthenticated()).toBe(true);
      expect(authState.getCurrentUser()).toEqual(mockUser);
    });

    it('should not authenticate if only token is present (no user)', () => {
      // Ensure we start from a clean state
      authState.logout();
      storage.getItem.mockReset();

      storage.getItem.mockImplementation((key) => {
        if (key === 'auth_token') return 'mock-token';
        return null;
      });

      authState.loadFromStorage();

      expect(authState.isAuthenticated()).toBe(false);
    });
  });

  // ─── isAuthenticated ──────────────────────────────────────
  describe('isAuthenticated', () => {
    it('should return false when no token and no user', () => {
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('should return true when both token and user are set', () => {
      authState.setAuthData('token-123', { id: 'u1', role: 'user' });
      expect(authState.isAuthenticated()).toBe(true);
    });
  });

  // ─── getCurrentUser ───────────────────────────────────────
  describe('getCurrentUser', () => {
    it('should return null when not authenticated', () => {
      expect(authState.getCurrentUser()).toBeNull();
    });

    it('should return user object when authenticated', () => {
      const user = { id: 'u1', email: 'test@test.com', role: 'user' };
      authState.setAuthData('token-123', user);
      expect(authState.getCurrentUser()).toEqual(user);
    });
  });

  // ─── isAdmin ──────────────────────────────────────────────
  describe('isAdmin', () => {
    it('should return false when not authenticated', () => {
      expect(authState.isAdmin()).toBe(false);
    });

    it('should return false for non-admin user', () => {
      authState.setAuthData('token', { id: 'u1', role: 'user' });
      expect(authState.isAdmin()).toBe(false);
    });

    it('should return true for admin user', () => {
      authState.setAuthData('token', { id: 'u1', role: 'admin' });
      expect(authState.isAdmin()).toBe(true);
    });
  });

  // ─── getRole ──────────────────────────────────────────────
  describe('getRole', () => {
    it('should return null when not authenticated', () => {
      expect(authState.getRole()).toBeNull();
    });

    it('should return the user role', () => {
      authState.setAuthData('token', { id: 'u1', role: 'editor' });
      expect(authState.getRole()).toBe('editor');
    });
  });

  // ─── updateCurrentUser ────────────────────────────────────
  describe('updateCurrentUser', () => {
    it('should do nothing when not authenticated', () => {
      authState.updateCurrentUser({ fullName: 'New Name' });
      expect(authState.getCurrentUser()).toBeNull();
      expect(storage.setItem).not.toHaveBeenCalledWith('user', expect.anything());
    });

    it('should merge updates into the current user', () => {
      authState.setAuthData('token', { id: 'u1', fullName: 'Old', role: 'user' });
      authState.updateCurrentUser({ fullName: 'New Name' });

      const user = authState.getCurrentUser();
      expect(user.fullName).toBe('New Name');
      expect(user.id).toBe('u1');
      expect(user.role).toBe('user');
    });

    it('should save updated user to storage', () => {
      authState.setAuthData('token', { id: 'u1', role: 'user' });
      storage.setItem.mockClear();

      authState.updateCurrentUser({ fullName: 'Updated' });
      expect(storage.setItem).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ fullName: 'Updated' }),
      );
    });

    it('should notify listeners', () => {
      authState.setAuthData('token', { id: 'u1', role: 'user' });
      const listener = vi.fn();
      authState.subscribe(listener);
      listener.mockClear();

      authState.updateCurrentUser({ fullName: 'Updated' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ─── register ─────────────────────────────────────────────
  describe('register', () => {
    it('should call apiClient.post with registration data', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com', role: 'user' };
      apiClient.post.mockResolvedValue({
        accessToken: 'new-token',
        user: mockUser,
      });

      const result = await authState.register({
        email: 'test@test.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@test.com',
        password: 'password123',
        fullName: 'Test User',
      });
      expect(result).toEqual(mockUser);
      expect(authState.isAuthenticated()).toBe(true);
    });

    it('should set auth data after successful registration', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com' };
      apiClient.post.mockResolvedValue({
        accessToken: 'reg-token',
        user: mockUser,
      });

      await authState.register({
        email: 'test@test.com',
        password: 'pass',
        fullName: 'User',
      });

      expect(storage.setItem).toHaveBeenCalledWith('auth_token', 'reg-token');
      expect(storage.setItem).toHaveBeenCalledWith('user', mockUser);
    });

    it('should throw on registration failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Registration failed'));

      await expect(
        authState.register({ email: 'x', password: 'y', fullName: 'z' }),
      ).rejects.toThrow('Registration failed');

      console.error.mockRestore();
    });
  });

  // ─── login ────────────────────────────────────────────────
  describe('login', () => {
    it('should call apiClient.post with login credentials', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com' };
      apiClient.post.mockResolvedValue({
        accessToken: 'login-token',
        user: mockUser,
      });

      const result = await authState.login('test@test.com', 'password123');

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'password123',
      });
      expect(result).toEqual(mockUser);
    });

    it('should set auth data after successful login', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com' };
      apiClient.post.mockResolvedValue({
        accessToken: 'login-token',
        user: mockUser,
      });

      await authState.login('test@test.com', 'password123');

      expect(authState.isAuthenticated()).toBe(true);
      expect(storage.setItem).toHaveBeenCalledWith('auth_token', 'login-token');
      expect(storage.setItem).toHaveBeenCalledWith('user', mockUser);
    });

    it('should throw on login failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      apiClient.post.mockRejectedValue(new Error('Invalid credentials'));

      await expect(authState.login('bad@email.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );

      console.error.mockRestore();
    });
  });

  // ─── logout ───────────────────────────────────────────────
  describe('logout', () => {
    it('should clear state', () => {
      authState.setAuthData('token', { id: 'u1' });
      authState.logout();

      expect(authState.isAuthenticated()).toBe(false);
      expect(authState.getCurrentUser()).toBeNull();
    });

    it('should clear storage', () => {
      authState.setAuthData('token', { id: 'u1' });
      storage.setItem.mockClear();

      authState.logout();

      expect(storage.setItem).toHaveBeenCalledWith('auth_token', null);
      expect(storage.setItem).toHaveBeenCalledWith('user', null);
    });

    it('should notify listeners', () => {
      authState.setAuthData('token', { id: 'u1' });
      const listener = vi.fn();
      authState.subscribe(listener);
      listener.mockClear();

      authState.logout();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(null);
    });
  });

  // ─── setAuthData ──────────────────────────────────────────
  describe('setAuthData', () => {
    it('should set token and user', () => {
      const user = { id: 'u1', role: 'user' };
      authState.setAuthData('abc-token', user);

      expect(authState.isAuthenticated()).toBe(true);
      expect(authState.getCurrentUser()).toEqual(user);
    });

    it('should persist to storage', () => {
      const user = { id: 'u1' };
      authState.setAuthData('tok', user);

      expect(storage.setItem).toHaveBeenCalledWith('auth_token', 'tok');
      expect(storage.setItem).toHaveBeenCalledWith('user', user);
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      authState.subscribe(listener);

      authState.setAuthData('token', { id: 'u1' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ─── subscribe ────────────────────────────────────────────
  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = authState.subscribe(listener);

      authState.setAuthData('token', { id: 'u1' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      authState.setAuthData('token2', { id: 'u2' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      authState.subscribe(listener1);
      authState.subscribe(listener2);

      authState.setAuthData('token', { id: 'u1' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should pass the user to listeners', () => {
      const listener = vi.fn();
      authState.subscribe(listener);

      const user = { id: 'u1', email: 'test@test.com' };
      authState.setAuthData('token', user);

      expect(listener).toHaveBeenCalledWith(user);
    });

    it('should not crash if a listener throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const normalListener = vi.fn();

      authState.subscribe(errorListener);
      authState.subscribe(normalListener);

      expect(() => authState.setAuthData('token', { id: 'u1' })).not.toThrow();
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error.mockRestore();
    });
  });

  // ─── refreshToken ─────────────────────────────────────────
  describe('refreshToken', () => {
    it('should call apiClient.post with current token', async () => {
      authState.setAuthData('old-token', { id: 'u1' });
      apiClient.post.mockResolvedValue({ token: 'new-token' });

      const result = await authState.refreshToken();

      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        token: 'old-token',
      });
      expect(result).toBe('new-token');
    });

    it('should update token in storage', async () => {
      authState.setAuthData('old-token', { id: 'u1' });
      storage.setItem.mockClear();

      apiClient.post.mockResolvedValue({ token: 'refreshed-token' });
      await authState.refreshToken();

      expect(storage.setItem).toHaveBeenCalledWith('auth_token', 'refreshed-token');
    });

    it('should call logout on refresh failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      authState.setAuthData('old-token', { id: 'u1' });
      apiClient.post.mockRejectedValue(new Error('Refresh failed'));

      await expect(authState.refreshToken()).rejects.toThrow('Refresh failed');
      expect(authState.isAuthenticated()).toBe(false);

      console.error.mockRestore();
    });
  });
});
