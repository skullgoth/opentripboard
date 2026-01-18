// T067: Auth routes - POST /auth/register, /auth/login, /auth/refresh
import * as userService from '../services/user-service.js';
import siteConfigService from '../services/site-config-service.js';
import { validateBody } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/error-handler.js';

const registerSchema = {
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
  },
  additionalProperties: false,
};

const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
    },
  },
  additionalProperties: false,
};

const refreshSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
    },
  },
  additionalProperties: false,
};

const logoutSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
    },
  },
  additionalProperties: false,
};

export default async function authRoutes(fastify) {
  /**
   * Register a new user
   */
  fastify.post(
    '/auth/register',
    {
      preHandler: validateBody(registerSchema),
    },
    asyncHandler(async (request, reply) => {
      // Check if registration is enabled
      const registrationEnabled = await siteConfigService.getRegistrationEnabled();
      if (!registrationEnabled) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'User registration is currently disabled',
          code: 'REGISTRATION_DISABLED',
        });
      }

      const { email, password, fullName } = request.body;

      const result = await userService.register({ email, password, fullName });

      reply.code(201).send(result);
    })
  );

  /**
   * Login with email and password
   */
  fastify.post(
    '/auth/login',
    {
      preHandler: validateBody(loginSchema),
    },
    asyncHandler(async (request, reply) => {
      const { email, password } = request.body;

      const result = await userService.authenticate(email, password);

      reply.send(result);
    })
  );

  /**
   * Refresh access token
   */
  fastify.post(
    '/auth/refresh',
    {
      preHandler: validateBody(refreshSchema),
    },
    asyncHandler(async (request, reply) => {
      const { refreshToken } = request.body;

      const result = await userService.refreshAccessToken(refreshToken);

      reply.send(result);
    })
  );

  /**
   * Logout and revoke refresh token
   */
  fastify.post(
    '/auth/logout',
    {
      preHandler: validateBody(logoutSchema),
    },
    asyncHandler(async (request, reply) => {
      const { refreshToken } = request.body;

      await userService.logout(refreshToken);

      reply.send({ success: true });
    })
  );

  /**
   * Get current user profile
   */
  fastify.get(
    '/auth/me',
    {
      preHandler: fastify.auth,
    },
    asyncHandler(async (request, reply) => {
      const user = await userService.getProfile(request.user.userId);
      reply.send({ user });
    })
  );
}
