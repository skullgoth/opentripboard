// US8: User management routes - profile and admin CRUD
import { validateBody } from '../middleware/validation.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error-handler.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  findById,
  findAllUsers,
  updateUser,
  adminUpdateUser,
  deleteUser,
  countAdmins,
  findByEmail,
  createUser,
} from '../db/queries/users.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/crypto.js';

// Schemas for validation
const updateProfileSchema = {
  type: 'object',
  properties: {
    fullName: {
      type: 'string',
      maxLength: 255,
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
  },
  additionalProperties: false,
};

const changePasswordSchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  properties: {
    currentPassword: {
      type: 'string',
    },
    newPassword: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
    },
  },
  additionalProperties: false,
};

const adminUpdateUserSchema = {
  type: 'object',
  properties: {
    fullName: {
      type: 'string',
      maxLength: 255,
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
    role: {
      type: 'string',
      enum: ['user', 'admin'],
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
    },
  },
  additionalProperties: false,
};

const adminCreateUserSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
    },
    fullName: {
      type: 'string',
      maxLength: 255,
    },
    role: {
      type: 'string',
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  additionalProperties: false,
};

export default async function usersRoutes(fastify) {
  // =============================================
  // PROFILE ROUTES (for authenticated users)
  // =============================================

  /**
   * Get current user's profile
   */
  fastify.get(
    '/users/profile',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const user = await findById(request.user.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    })
  );

  /**
   * Update current user's profile
   */
  fastify.patch(
    '/users/profile',
    {
      preHandler: [fastify.auth, validateBody(updateProfileSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { fullName, email } = request.body;
      const userId = request.user.userId;

      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await findByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          throw new ValidationError('Email already in use');
        }
      }

      const updated = await updateUser(userId, { fullName, email });

      reply.send({
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.full_name,
          role: updated.role,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      });
    })
  );

  /**
   * Change current user's password
   */
  fastify.post(
    '/users/profile/password',
    {
      preHandler: [fastify.auth, validateBody(changePasswordSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      const userId = request.user.userId;

      // Get user with password hash
      const user = await findByEmail(request.user.email);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new ValidationError('New password does not meet requirements', passwordValidation.errors);
      }

      // Hash and update password
      const passwordHash = await hashPassword(newPassword);
      await updateUser(userId, { passwordHash });

      reply.send({ message: 'Password updated successfully' });
    })
  );

  // =============================================
  // ADMIN ROUTES (for admin users only)
  // =============================================

  /**
   * List all users (admin only)
   */
  fastify.get(
    '/admin/users',
    {
      preHandler: [fastify.auth, requireAdmin],
    },
    asyncHandler(async (request, reply) => {
      const { limit = 50, offset = 0, search = '' } = request.query;

      const { users, total } = await findAllUsers({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        search,
      });

      reply.send({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
        pagination: {
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        },
      });
    })
  );

  /**
   * Get a specific user (admin only)
   */
  fastify.get(
    '/admin/users/:userId',
    {
      preHandler: [fastify.auth, requireAdmin],
    },
    asyncHandler(async (request, reply) => {
      const { userId } = request.params;

      const user = await findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    })
  );

  /**
   * Create a new user (admin only)
   */
  fastify.post(
    '/admin/users',
    {
      preHandler: [fastify.auth, requireAdmin, validateBody(adminCreateUserSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { email, password, fullName, role = 'user' } = request.body;

      // Check if email already exists
      const existingUser = await findByEmail(email);
      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await createUser({
        email,
        passwordHash,
        fullName: fullName || null,
        role,
      });

      reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    })
  );

  /**
   * Update a user (admin only)
   */
  fastify.patch(
    '/admin/users/:userId',
    {
      preHandler: [fastify.auth, requireAdmin, validateBody(adminUpdateUserSchema)],
    },
    asyncHandler(async (request, reply) => {
      const { userId } = request.params;
      const { fullName, email, role, password } = request.body;

      // Check if user exists
      const existingUser = await findById(userId);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== existingUser.email) {
        const emailUser = await findByEmail(email);
        if (emailUser) {
          throw new ValidationError('Email already in use');
        }
      }

      // Prevent removing the last admin
      if (role === 'user' && existingUser.role === 'admin') {
        const adminCount = await countAdmins();
        if (adminCount <= 1) {
          throw new ValidationError('Cannot remove the last admin user');
        }
      }

      // Prepare updates
      const updates = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;

      // Handle password change
      if (password) {
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
          throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
        }
        updates.passwordHash = await hashPassword(password);
      }

      if (Object.keys(updates).length === 0) {
        throw new ValidationError('No fields to update');
      }

      const updated = await adminUpdateUser(userId, updates);

      reply.send({
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.full_name,
          role: updated.role,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      });
    })
  );

  /**
   * Delete a user (admin only)
   */
  fastify.delete(
    '/admin/users/:userId',
    {
      preHandler: [fastify.auth, requireAdmin],
    },
    asyncHandler(async (request, reply) => {
      const { userId } = request.params;

      // Check if user exists
      const user = await findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent self-deletion
      if (userId === request.user.userId) {
        throw new ValidationError('Cannot delete your own account');
      }

      // Prevent deleting the last admin
      if (user.role === 'admin') {
        const adminCount = await countAdmins();
        if (adminCount <= 1) {
          throw new ValidationError('Cannot delete the last admin user');
        }
      }

      await deleteUser(userId);

      reply.code(204).send();
    })
  );
}
