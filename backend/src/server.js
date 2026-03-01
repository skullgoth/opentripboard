// T035 & T036: Fastify server setup with plugins, routes, and security
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { testConnection } from './db/connection.js';
import { runPendingMigrations } from './db/migrate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authenticate } from './middleware/auth.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { cachePlugin } from './middleware/cache.js';
import { csrfPlugin } from './middleware/csrf.js';
import { MAX_UPLOAD_SIZE_BYTES } from './config/upload.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost';
const isDev = process.env.NODE_ENV === 'development';

/**
 * Get CORS origin configuration
 * In development, allow localhost and configured CORS_ORIGIN
 * In production, use the CORS_ORIGIN environment variable
 */
function getCorsOrigin() {
  if (isDev) {
    // In development, allow localhost with any port and CORS_ORIGIN
    return (origin, callback) => {
      if (
        !origin ||
        origin.match(/^http:\/\/localhost(:\d+)?$/) ||
        origin === CORS_ORIGIN
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    };
  }

  // In production, use exact origin from environment
  return CORS_ORIGIN;
}

/**
 * Create and configure Fastify server
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(isDev && {
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  });

  // Register CORS
  await fastify.register(cors, {
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
  });

  // Register Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", ...(isDev ? ["'unsafe-inline'"] : [])],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // Register Swagger API docs (development only)
  if (isDev) {
    const swagger = await import('@fastify/swagger');
    const swaggerUi = await import('@fastify/swagger-ui');

    await fastify.register(swagger.default, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'OpenTripBoard API',
          description: 'Self-hosted travel planning API with real-time collaboration',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${PORT}`,
            description: 'Local development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: [
          { name: 'auth', description: 'Authentication & registration' },
          { name: 'trips', description: 'Trip management' },
          { name: 'activities', description: 'Trip activities' },
          { name: 'buddies', description: 'Trip collaborators' },
          { name: 'suggestions', description: 'Trip suggestions' },
          { name: 'reservations', description: 'Travel reservations' },
          { name: 'expenses', description: 'Trip expenses' },
          { name: 'lists', description: 'Packing & todo lists' },
          { name: 'documents', description: 'Trip documents' },
          { name: 'users', description: 'User management' },
          { name: 'preferences', description: 'User preferences' },
          { name: 'export', description: 'Trip export' },
          { name: 'site-config', description: 'Site configuration' },
          { name: 'categories', description: 'Trip categories' },
          { name: 'geocoding', description: 'Geocoding & autocomplete' },
          { name: 'cover-images', description: 'Cover image generation' },
          { name: 'routing', description: 'Transport routing' },
          { name: 'health', description: 'Health checks' },
        ],
      },
    });

    await fastify.register(swaggerUi.default, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  // Register rate limiting
  await registerRateLimit(fastify);

  // Register cache headers plugin
  await fastify.register(cachePlugin);

  // Register CSRF protection (enabled by default)
  // Note: CSRF plugin will register cookie support automatically if needed
  await fastify.register(csrfPlugin);

  // Register WebSocket support
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      clientTracking: true,
    },
  });

  // Register multipart/form-data support for file uploads
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: MAX_UPLOAD_SIZE_BYTES,
      files: 1,
    },
  });

  // Register static file serving for uploads
  await fastify.register(import('@fastify/static'), {
    root: process.cwd(),
    prefix: '/',
    decorateReply: false,
  });

  // Health check route (registered early, before authentication)
  await fastify.register(import('./routes/health.js'));

  // API routes (v1)
  await fastify.register(
    async (instance) => {
      // Decorate with auth middleware
      instance.decorate('auth', authenticate);

      // Register routes
      await instance.register(import('./routes/auth.js'));
      await instance.register(import('./routes/trips.js'));
      await instance.register(import('./routes/activities.js'));
      await instance.register(import('./routes/trip-buddies.js'));
      await instance.register(import('./routes/suggestions.js'));
      await instance.register(import('./routes/reservations.js'));
      await instance.register(import('./routes/expenses.js'));
      await instance.register(import('./routes/lists.js'));
      await instance.register(import('./routes/documents.js'));
      await instance.register(import('./routes/users.js'));
      await instance.register(import('./routes/export.js'));
      await instance.register(import('./routes/preferences.js'));
      // Site configuration routes for admin settings
      await instance.register(import('./routes/site-config.js'));
      // Categories routes for custom trip categories
      await instance.register(import('./routes/categories.js'));
      // T012: Geocoding routes for destination autocomplete
      await instance.register(import('./routes/geocoding.js'), {
        prefix: '/geocoding',
      });
      // T026: Cover image routes for automatic cover generation
      await instance.register(import('./routes/cover-images.js'), {
        prefix: '/cover-images',
      });
      // Transport routing routes for distance/duration calculation
      await instance.register(import('./routes/routing.js'), {
        prefix: '/routing',
      });
    },
    { prefix: '/api/v1' }
  );

  // WebSocket routes
  await fastify.register(
    async (instance) => {
      await instance.register(import('./websocket/server.js'));
    },
    { prefix: '/ws' }
  );

  // Global error handler
  fastify.setErrorHandler(errorHandler);

  // 404 handler
  fastify.setNotFoundHandler(notFoundHandler);

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  let fastify;

  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Run pending migrations
    console.log('Checking for pending migrations...');
    await runPendingMigrations();

    // Create server
    fastify = await createServer();

    // Start listening
    await fastify.listen({ port: PORT, host: HOST });

    console.log(`Server listening on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down gracefully...`);

    try {
      await fastify.close();
      console.log('Server closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createServer, start };
