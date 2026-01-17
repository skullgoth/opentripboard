import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock pg module at the top
vi.mock('pg', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  const mockPg = { Pool: vi.fn(() => mockPool) };
  return { default: mockPg, ...mockPg };
});

describe('Users Routes', () => {
  let app;
  let userQueries;
  let crypto;

  beforeEach(async () => {
    vi.resetModules(); // Reset modules to allow re-importing with fresh mocks

    // Mock services and middleware using vi.doMock
    vi.doMock('../../../src/db/queries/users.js', () => ({
      findById: vi.fn(),
      findAllUsers: vi.fn(),
      updateUser: vi.fn(),
      adminUpdateUser: vi.fn(),
      deleteUser: vi.fn(),
      countAdmins: vi.fn(),
      findByEmail: vi.fn(),
      createUser: vi.fn(),
    }));

    vi.doMock('../../../src/utils/crypto.js', () => ({
      hashPassword: vi.fn(),
      verifyPassword: vi.fn(),
      validatePasswordStrength: vi.fn(),
    }));

    vi.doMock('../../../src/middleware/auth.js', () => ({
      authenticate: vi.fn((req, reply, done) => {
        req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
        done();
      }),
      requireAdmin: vi.fn((req, reply, done) => {
        if (req.user && req.user.role === 'admin') {
          done();
        } else {
          reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
        }
      }),
    }));

    vi.doMock('../../../src/middleware/validation.js', () => ({
      validateBody: vi.fn(() => (req, reply, done) => done()),
      validateParams: vi.fn(() => (req, reply, done) => done()),
    }));

    vi.doMock('../../../src/middleware/error-handler.js', () => ({
      asyncHandler: (fn) => async (req, reply) => {
        try {
          await fn(req, reply);
        } catch (err) {
          reply.status(err.statusCode || 500).send({ error: err.message });
        }
      },
      NotFoundError: class NotFoundError extends Error {
        constructor(message) { super(message); this.statusCode = 404; }
      },
      ValidationError: class ValidationError extends Error {
        constructor(message) { super(message); this.statusCode = 400; }
      },
      ForbiddenError: class ForbiddenError extends Error {
        constructor(message) { super(message); this.statusCode = 403; }
      },
    }));

    // Dynamically import the router and mocked service after mocks are in place
    const usersRoutes = (await import('../../../src/routes/users.js')).default;
    userQueries = await import('../../../src/db/queries/users.js');
    crypto = await import('../../../src/utils/crypto.js');

    app = Fastify();
    app.decorate('auth', vi.fn((req, reply, done) => {
      req.user = { userId: 'user-123', role: 'user', email: 'test@example.com' };
      done();
    }));
    app.decorate('requireAdmin', vi.fn((req, reply, done) => {
      if (req.user && req.user.role === 'admin') {
        done();
      } else {
        reply.code(403).send({ error: 'Forbidden', message: 'Admin access required' });
      }
    }));
    app.register(usersRoutes);
  });

  describe('GET /users/profile', () => {
    it('should return the current user\'s profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };
      userQueries.findById.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/users/profile',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.full_name,
        role: mockUser.role,
        createdAt: mockUser.created_at.toISOString(),
        updatedAt: mockUser.updated_at.toISOString(),
      });
      expect(userQueries.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if user not found', async () => {
      userQueries.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/users/profile',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('User not found');
    });
  });

  describe('PATCH /users/profile', () => {
    it('should update the current user\'s profile', async () => {
      const originalUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };
      const updateData = { fullName: 'Updated Name', email: 'new@example.com' };
      const updatedUser = {
        ...originalUser,
        full_name: updateData.fullName,
        email: updateData.email,
        updated_at: new Date(),
      };

      userQueries.findByEmail.mockResolvedValue(null); // No conflict for new email
      userQueries.updateUser.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/profile',
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user).toEqual({
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        role: updatedUser.role,
        createdAt: updatedUser.created_at.toISOString(),
        updatedAt: updatedUser.updated_at.toISOString(),
      });
      expect(userQueries.updateUser).toHaveBeenCalledWith('user-123', {
        fullName: updateData.fullName,
        email: updateData.email,
      });
    });

    it('should return 400 if new email is already in use', async () => {
      const existingUser = { id: 'user-456', email: 'new@example.com' };
      userQueries.findByEmail.mockResolvedValue(existingUser);

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/profile',
        payload: { email: 'new@example.com' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Email already in use');
    });

    it('should return 400 if no fields are provided for update', async () => {
      userQueries.findByEmail.mockResolvedValue(null); // No conflict

      // Simulate ValidationError from service layer
      userQueries.updateUser.mockImplementation(() => {
        const error = new Error('No fields to update');
        error.statusCode = 400;
        throw error;
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/profile',
        payload: {}, // Empty payload
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('No fields to update');
    });
  });

  describe('POST /users/profile/password', () => {
    const changePasswordPayload = {
      currentPassword: 'OldPassword123',
      newPassword: 'NewStrongPassword123',
    };
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-old-password',
      full_name: 'Test User',
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should change current user\'s password successfully', async () => {
      userQueries.findByEmail.mockResolvedValue(mockUser);
      crypto.verifyPassword.mockResolvedValue(true); // Current password is correct
      crypto.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] }); // New password is strong
      crypto.hashPassword.mockResolvedValue('hashed-new-password');
      userQueries.updateUser.mockResolvedValue({ ...mockUser, password_hash: 'hashed-new-password' });

      const response = await app.inject({
        method: 'POST',
        url: '/users/profile/password',
        payload: changePasswordPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toBe('Password updated successfully');
      expect(userQueries.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(crypto.verifyPassword).toHaveBeenCalledWith(
        changePasswordPayload.currentPassword,
        mockUser.password_hash
      );
      expect(crypto.validatePasswordStrength).toHaveBeenCalledWith(changePasswordPayload.newPassword);
      expect(crypto.hashPassword).toHaveBeenCalledWith(changePasswordPayload.newPassword);
      expect(userQueries.updateUser).toHaveBeenCalledWith(
        'user-123',
        { passwordHash: 'hashed-new-password' }
      );
    });

    it('should return 400 if current password is incorrect', async () => {
      userQueries.findByEmail.mockResolvedValue(mockUser);
      crypto.verifyPassword.mockResolvedValue(false); // Current password is incorrect

      const response = await app.inject({
        method: 'POST',
        url: '/users/profile/password',
        payload: changePasswordPayload,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Current password is incorrect');
    });

    it('should return 400 if new password is weak', async () => {
      userQueries.findByEmail.mockResolvedValue(mockUser);
      crypto.verifyPassword.mockResolvedValue(true);
      crypto.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too short'],
      }); // New password is weak

      const response = await app.inject({
        method: 'POST',
        url: '/users/profile/password',
        payload: changePasswordPayload,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('New password does not meet requirements');
    });

    it('should return 404 if user not found', async () => {
      userQueries.findByEmail.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/users/profile/password',
        payload: changePasswordPayload,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('User not found');
    });
  });

  describe('GET /admin/users', () => {
    let adminApp;

    beforeEach(async () => {
      // Re-register app with admin user context
      vi.resetModules();
      const usersRoutes = (await import('../../../src/routes/users.js')).default;
      userQueries = await import('../../../src/db/queries/users.js');
      crypto = await import('../../../src/utils/crypto.js');

      adminApp = Fastify();
      adminApp.decorate('auth', vi.fn((req, reply, done) => {
        req.user = { userId: 'admin-123', role: 'admin', email: 'admin@example.com' };
        done();
      }));
      adminApp.decorate('requireAdmin', vi.fn((req, reply, done) => {
        // This mock ensures requireAdmin always calls done() for our admin user
        done();
      }));
      adminApp.register(usersRoutes);
    });

    it('should return a list of all users for admin', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', full_name: 'User One', role: 'user' },
        { id: 'admin-1', email: 'admin1@example.com', full_name: 'Admin One', role: 'admin' },
      ];
      userQueries.findAllUsers.mockResolvedValue({ users: mockUsers, total: 2 });

      const response = await adminApp.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.users.length).toBe(2);
      expect(payload.users[0].email).toBe('user1@example.com');
      expect(payload.pagination.total).toBe(2);
      expect(userQueries.findAllUsers).toHaveBeenCalledWith({ limit: 50, offset: 0, search: '' });
    });

    it('should return 403 if non-admin tries to access', async () => {
      // In this test, the default app (non-admin) is used
      userQueries.findAllUsers.mockResolvedValue({ users: [], total: 0 }); // Just to prevent errors if service is called

      const response = await app.inject({
        method: 'GET',
        url: '/admin/users',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).message).toBe('Admin access required');
    });

    it('should handle pagination and search parameters', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', full_name: 'User One', role: 'user' },
      ];
      userQueries.findAllUsers.mockResolvedValue({ users: mockUsers, total: 1 });

      const response = await adminApp.inject({
        method: 'GET',
        url: '/admin/users?limit=10&offset=5&search=user',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.users.length).toBe(1);
      expect(payload.pagination).toEqual({ limit: 10, offset: 5, total: 1 });
      expect(userQueries.findAllUsers).toHaveBeenCalledWith({ limit: 10, offset: 5, search: 'user' });
    });
  });

  describe('GET /admin/users/:userId', () => {
    let adminApp;

    beforeEach(async () => {
      // Re-register app with admin user context
      vi.resetModules();
      const usersRoutes = (await import('../../../src/routes/users.js')).default;
      userQueries = await import('../../../src/db/queries/users.js');
      crypto = await import('../../../src/utils/crypto.js');

      adminApp = Fastify();
      adminApp.decorate('auth', vi.fn((req, reply, done) => {
        req.user = { userId: 'admin-123', role: 'admin', email: 'admin@example.com' };
        done();
      }));
      adminApp.decorate('requireAdmin', vi.fn((req, reply, done) => {
        // This mock ensures requireAdmin always calls done() for our admin user
        done();
      }));
      adminApp.register(usersRoutes);
    });

    it('should return a specific user for admin', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'Regular User',
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      };
      userQueries.findById.mockResolvedValue(mockUser);

      const response = await adminApp.inject({
        method: 'GET',
        url: '/admin/users/user-123',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        fullName: mockUser.full_name,
        role: mockUser.role,
        createdAt: mockUser.created_at.toISOString(),
        updatedAt: mockUser.updated_at.toISOString(),
      });
      expect(userQueries.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return 403 if non-admin tries to access', async () => {
      userQueries.findById.mockResolvedValue(null); // Just to prevent errors if service is called

      const response = await app.inject({
        method: 'GET',
        url: '/admin/users/user-123',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).message).toBe('Admin access required');
    });

    it('should return 404 if user not found for admin', async () => {
      userQueries.findById.mockResolvedValue(null);

      const response = await adminApp.inject({
        method: 'GET',
        url: '/admin/users/non-existent-user',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('User not found');
    });
  });

  describe('POST /admin/users', () => {
    let adminApp;

    beforeEach(async () => {
      // Re-register app with admin user context
      vi.resetModules();
      const usersRoutes = (await import('../../../src/routes/users.js')).default;
      userQueries = await import('../../../src/db/queries/users.js');
      crypto = await import('../../../src/utils/crypto.js');

      adminApp = Fastify();
      adminApp.decorate('auth', vi.fn((req, reply, done) => {
        req.user = { userId: 'admin-123', role: 'admin', email: 'admin@example.com' };
        done();
      }));
      adminApp.decorate('requireAdmin', vi.fn((req, reply, done) => {
        // This mock ensures requireAdmin always calls done() for our admin user
        done();
      }));
      adminApp.register(usersRoutes);
    });

    const createPayload = {
      email: 'newuser@example.com',
      password: 'StrongPassword123',
      fullName: 'New Admin User',
      role: 'admin',
    };

    it('should create a new user for admin', async () => {
      const mockCreatedUser = {
        id: 'new-user-id',
        ...createPayload,
        created_at: new Date(),
        updated_at: new Date(),
      };
      userQueries.findByEmail.mockResolvedValue(null); // Email not in use
      crypto.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });
      crypto.hashPassword.mockResolvedValue('hashed-password');
      userQueries.createUser.mockResolvedValue(mockCreatedUser);

      const response = await adminApp.inject({
        method: 'POST',
        url: '/admin/users',
        payload: createPayload,
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.user.email).toBe(createPayload.email);
      expect(payload.user.role).toBe(createPayload.role);
      expect(userQueries.createUser).toHaveBeenCalledWith(expect.objectContaining({
        email: createPayload.email,
        passwordHash: 'hashed-password',
        role: createPayload.role,
      }));
    });

    it('should return 403 if non-admin tries to create user', async () => {
      // Use the default app (non-admin)
      userQueries.findByEmail.mockResolvedValue(null);
      crypto.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });

      const response = await app.inject({
        method: 'POST',
        url: '/admin/users',
        payload: createPayload,
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).message).toBe('Admin access required');
    });

    it('should return 400 if email already in use', async () => {
      const existingUser = { id: 'existing-id', email: createPayload.email };
      userQueries.findByEmail.mockResolvedValue(existingUser);

      const response = await adminApp.inject({
        method: 'POST',
        url: '/admin/users',
        payload: createPayload,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('User with this email already exists');
    });

    it('should return 400 if password is weak', async () => {
      userQueries.findByEmail.mockResolvedValue(null);
      crypto.validatePasswordStrength.mockReturnValue({ isValid: false, errors: ['Too short'] });

      const response = await adminApp.inject({
        method: 'POST',
        url: '/admin/users',
        payload: createPayload,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Password does not meet requirements');
    });
  });

  describe('PATCH /admin/users/:userId', () => {
    let adminApp;

    beforeEach(async () => {
      // Re-register app with admin user context
      vi.resetModules();
      const usersRoutes = (await import('../../../src/routes/users.js')).default;
      userQueries = await import('../../../src/db/queries/users.js');
      crypto = await import('../../../src/utils/crypto.js');

      adminApp = Fastify();
      adminApp.decorate('auth', vi.fn((req, reply, done) => {
        req.user = { userId: 'admin-123', role: 'admin', email: 'admin@example.com' };
        done();
      }));
      adminApp.decorate('requireAdmin', vi.fn((req, reply, done) => {
        // This mock ensures requireAdmin always calls done() for our admin user
        done();
      }));
      adminApp.register(usersRoutes);
    });

    const mockUserToUpdate = {
      id: 'user-to-update',
      email: 'user@example.com',
      full_name: 'Original Name',
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    };
    const updatePayload = {
      fullName: 'New Name',
      email: 'new.user@example.com',
      role: 'admin',
      password: 'VeryStrongPassword123',
    };

    it('should update a user\'s profile for admin', async () => {
      const mockUpdatedUser = {
        ...mockUserToUpdate,
        full_name: updatePayload.fullName, // Use full_name to match database format
        email: updatePayload.email,
        role: updatePayload.role,
        updated_at: new Date(),
      };
      userQueries.findById.mockResolvedValue(mockUserToUpdate);
      userQueries.findByEmail.mockResolvedValue(null); // No conflict for new email
      crypto.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });
      crypto.hashPassword.mockResolvedValue('hashed-new-password');
      userQueries.adminUpdateUser.mockResolvedValue(mockUpdatedUser);

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/user-to-update',
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user.email).toBe(updatePayload.email);
      expect(payload.user.fullName).toBe(updatePayload.fullName);
      expect(payload.user.role).toBe(updatePayload.role);
      expect(userQueries.adminUpdateUser).toHaveBeenCalledWith('user-to-update', expect.objectContaining({
        fullName: updatePayload.fullName,
        email: updatePayload.email,
        role: updatePayload.role,
        passwordHash: 'hashed-new-password',
      }));
    });

    it('should return 403 if non-admin tries to update user', async () => {
      userQueries.findById.mockResolvedValue(mockUserToUpdate);

      const response = await app.inject({
        method: 'PATCH',
        url: '/admin/users/user-to-update',
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).message).toBe('Admin access required');
    });

    it('should return 404 if user to update is not found', async () => {
      userQueries.findById.mockResolvedValue(null);

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/non-existent-user',
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('User not found');
    });

    it('should return 400 if new email is already in use by another user', async () => {
      const conflictingUser = { id: 'other-user', email: updatePayload.email };
      userQueries.findById.mockResolvedValue(mockUserToUpdate);
      userQueries.findByEmail.mockResolvedValue(conflictingUser);

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/user-to-update',
        payload: { email: updatePayload.email },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Email already in use');
    });

    it('should return 400 if trying to demote last admin', async () => {
      const lastAdminUser = { ...mockUserToUpdate, id: 'admin-only', role: 'admin' };
      userQueries.findById.mockResolvedValue(lastAdminUser);
      userQueries.findByEmail.mockResolvedValue(null); // No email change
      userQueries.countAdmins.mockResolvedValue(1); // Only one admin exists

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/admin-only',
        payload: { role: 'user' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Cannot remove the last admin user');
    });

    it('should return 400 if new password is weak', async () => {
      userQueries.findById.mockResolvedValue(mockUserToUpdate);
      userQueries.findByEmail.mockResolvedValue(null);
      crypto.validatePasswordStrength.mockReturnValue({ isValid: false, errors: ['Too short'] });

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/user-to-update',
        payload: { password: 'weak' },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Password does not meet requirements');
    });

    it('should return 400 if no fields provided for update', async () => {
      userQueries.findById.mockResolvedValue(mockUserToUpdate);

      const response = await adminApp.inject({
        method: 'PATCH',
        url: '/admin/users/user-to-update',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('No fields to update');
    });
  });

  describe('DELETE /admin/users/:userId', () => {
    let adminApp;

    beforeEach(async () => {
      vi.resetModules();
      const usersRoutes = (await import('../../../src/routes/users.js')).default;
      userQueries = await import('../../../src/db/queries/users.js');
      crypto = await import('../../../src/utils/crypto.js');

      adminApp = Fastify();
      adminApp.decorate('auth', vi.fn((req, reply, done) => {
        req.user = { userId: 'admin-123', role: 'admin', email: 'admin@example.com' };
        done();
      }));
      adminApp.decorate('requireAdmin', vi.fn((req, reply, done) => {
        done();
      }));
      adminApp.register(usersRoutes);
    });

    it('should delete a user for admin', async () => {
      const userToDelete = { id: 'user-to-delete', role: 'user' };
      userQueries.findById.mockResolvedValue(userToDelete);
      userQueries.deleteUser.mockResolvedValue(true);

      const response = await adminApp.inject({
        method: 'DELETE',
        url: '/admin/users/user-to-delete',
      });

      expect(response.statusCode).toBe(204);
      expect(userQueries.deleteUser).toHaveBeenCalledWith('user-to-delete');
    });

    it('should return 403 if non-admin tries to delete user', async () => {
      userQueries.findById.mockResolvedValue({ id: 'user-to-delete', role: 'user' });

      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/users/user-to-delete',
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload).message).toBe('Admin access required');
    });

    it('should return 404 if user to delete is not found', async () => {
      userQueries.findById.mockResolvedValue(null);

      const response = await adminApp.inject({
        method: 'DELETE',
        url: '/admin/users/non-existent-user',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload).error).toBe('User not found');
    });

    it('should return 400 if admin tries to delete their own account', async () => {
      const adminUser = { id: 'admin-123', role: 'admin' };
      userQueries.findById.mockResolvedValue(adminUser);

      const response = await adminApp.inject({
        method: 'DELETE',
        url: '/admin/users/admin-123', // Admin trying to delete self
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Cannot delete your own account');
    });

    it('should return 400 if admin tries to delete the last admin user', async () => {
      const lastAdminUser = { id: 'admin-only', role: 'admin' };
      userQueries.findById.mockResolvedValue(lastAdminUser);
      userQueries.countAdmins.mockResolvedValue(1); // Only one admin exists

      const response = await adminApp.inject({
        method: 'DELETE',
        url: '/admin/users/admin-only',
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload).error).toBe('Cannot delete the last admin user');
    });
  });
});
