# AGENTS.md - Coding Agent Guidelines for OpenTripBoard

## Project Overview

Travel planning web app with Fastify backend, vanilla JS frontend, PostgreSQL database, and real-time WebSocket collaboration.

**Tech Stack:** Node.js 20+, Fastify 4.x, Vite 5.x, PostgreSQL 16, Leaflet.js, Playwright, Vitest

## Build/Lint/Test Commands

### Backend (run from `backend/`)

```bash
npm run dev                    # Start dev server with hot reload
npm run lint                   # ESLint check
npm run lint:fix               # ESLint auto-fix
npm run format                 # Prettier format
npm test                       # Run all Vitest tests
npm test -- <pattern>          # Run single test file (e.g., npm test -- trips)
npm test -- --watch            # Run tests in watch mode
npm run test:integration       # Run integration tests only
npm run test:coverage          # Run tests with coverage report
npm run migrate                # Run pending DB migrations
npm run migrate:down           # Roll back last migration
npm run db:reset               # Reset database (destructive)
```

### Frontend (run from `frontend/`)

```bash
npm run dev                    # Start Vite dev server (port 5173)
npm run build                  # Production build
npm run lint                   # ESLint check
npm run lint:fix               # ESLint auto-fix
npm run format                 # Prettier format
npm test                       # Run all Vitest unit tests
npm test -- <pattern>          # Run single test file (e.g., npm test -- trip-list)
npm test -- --watch            # Run tests in watch mode
npm run test:e2e               # Run all Playwright E2E tests
npx playwright test <file>     # Run single E2E test (e.g., npx playwright test trips.spec.js)
npm run test:e2e:ui            # Run E2E tests with interactive UI
npm run test:a11y              # Run accessibility tests
npm run test:coverage          # Run tests with coverage report
```

### Docker (run from project root)

```bash
docker compose up              # Start all services (db, backend, frontend, nginx)
docker compose up --build      # Rebuild and start
docker compose down -v         # Stop and remove volumes
```

## Code Style Guidelines

### Module System

- ES Modules everywhere (`import`/`export`, `"type": "module"` in package.json)
- Always include `.js` extension in imports
- Import order: external packages first, then internal modules

```javascript
// External first
import Fastify from 'fastify';
import cors from '@fastify/cors';

// Internal second
import * as tripService from '../services/trip-service.js';
import { authenticate } from '../middleware/auth.js';
```

### Formatting (Prettier enforced)

- 2-space indentation
- Single quotes
- Semicolons required
- Trailing commas (ES5 style)
- Max line width: 100 characters
- LF line endings

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/functions | camelCase | `tripData`, `createTrip` |
| Classes/constructors | PascalCase | `AppError`, `ValidationError` |
| Constants | UPPER_SNAKE_CASE | `JWT_SECRET`, `VALID_CATEGORIES` |
| Files | kebab-case | `trip-service.js`, `api-client.js` |
| CSS classes | kebab-case (BEM-like) | `trip-card`, `trip-card__title` |
| Database columns | snake_case | `start_date`, `owner_id` |
| API URLs | kebab-case | `/api/v1/trips/:id/cover-image` |
| Data attributes | kebab-case | `data-trip-id`, `data-action` |

### Error Handling

**Backend:** Use custom error classes, always throw (never return error codes):

```javascript
import { ValidationError, NotFoundError, AuthorizationError } from '../middleware/error-handler.js';

// In services - throw specific errors
if (!trip) {
  throw new NotFoundError('Trip');
}
if (!hasAccess) {
  throw new AuthorizationError('You do not have access to this trip');
}

// In routes - wrap handlers with asyncHandler
asyncHandler(async (request, reply) => {
  const trip = await tripService.create(request.user.userId, request.body);
  reply.code(201).send(trip);
})
```

**Frontend:** Use APIError class for API responses:

```javascript
import { APIError } from './services/api-client.js';

try {
  await apiClient.post('/trips', data);
} catch (error) {
  if (error instanceof APIError && error.status === 400) {
    // Handle validation errors
  }
}
```

### Async/Await

- Always use async/await over `.then()/.catch()`
- Wrap async route handlers with `asyncHandler`
- Never mix callbacks with promises

### Comments

**JSDoc for public functions:**

```javascript
/**
 * Create a new trip
 * @param {string} userId - Owner user ID
 * @param {Object} tripData - Trip data
 * @returns {Promise<Object>} Created trip
 */
export async function create(userId, tripData) { ... }
```

**Task references at file top:**

```javascript
// T068: Trip routes - CRUD operations
// T092 & T093: Cover image upload and delete endpoints
```

### Frontend Component Pattern

Components follow create + attach pattern:

```javascript
// create* returns HTML string
export function createTripList(trips, onTripClick) {
  return `<div class="trip-list">...</div>`;
}

// attach*Listeners binds events
export function attachTripListListeners(container, onTripClick) {
  container.querySelectorAll('[data-action="view-trip"]').forEach((el) => {
    el.addEventListener('click', () => { ... });
  });
}

// Always escape user content for XSS prevention
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### Backend Route Pattern

```javascript
export default async function tripRoutes(fastify) {
  fastify.post(
    '/trips',
    {
      preHandler: [authenticate, validateBody(createTripSchema)],
    },
    asyncHandler(async (request, reply) => {
      const trip = await tripService.create(request.user.userId, request.body);
      reply.code(201).send(trip);
    })
  );
}
```

### Database Queries

- Always use parameterized queries (NEVER string interpolation)
- SQL keywords uppercase, identifiers lowercase

```javascript
// Correct
await query('SELECT * FROM trips WHERE id = $1 AND owner_id = $2', [tripId, userId]);

// NEVER do this - SQL injection vulnerability
await query(`SELECT * FROM trips WHERE id = ${tripId}`);
```

### HTTP Status Codes

- 200: Success (GET, PUT, PATCH)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Validation Error
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Project Structure

```
backend/src/
  server.js              # Entry point, plugin registration
  db/
    connection.js        # PostgreSQL pool
    migrate.js           # Migration runner
    migrations/          # SQL migration files (###_description.sql)
    queries/             # Query modules (trips.js, users.js, etc.)
  routes/                # Fastify route handlers
  services/              # Business logic layer
  middleware/            # auth.js, validation.js, error-handler.js
  websocket/             # Real-time handlers
  utils/                 # jwt.js, crypto.js, logger.js

frontend/src/
  main.js                # Entry point, router setup
  components/            # Reusable UI (create* + attach* pattern)
  pages/                 # Page modules
  services/              # api-client.js, websocket-client.js
  state/                 # State management
  utils/                 # router.js, storage.js, formatters.js
  styles/                # CSS files
```

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, perf, test, chore
```

Examples:
- `feat(trips): add cover image upload functionality`
- `fix(auth): resolve token refresh race condition`
- `test(activities): add E2E tests for drag-and-drop`
