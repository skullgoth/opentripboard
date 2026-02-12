# OpenTripBoard API Reference

Base URL: `/api/v1`

All endpoints are prefixed with `/api/v1` unless otherwise noted. Requests and responses use JSON (`Content-Type: application/json`) unless otherwise specified.

---

## Table of Contents

- [Authentication](#authentication)
- [Health Check](#health-check)
- [Auth](#auth)
- [Users](#users)
- [Admin - Users](#admin---users)
- [Trips](#trips)
- [Activities](#activities)
- [Expenses](#expenses)
- [Suggestions](#suggestions)
- [Trip Buddies](#trip-buddies)
- [Lists](#lists)
- [Documents](#documents)
- [Reservations](#reservations)
- [Export & Sharing](#export--sharing)
- [Categories](#categories)
- [Preferences](#preferences)
- [Geocoding](#geocoding)
- [Routing](#routing)
- [Cover Images](#cover-images)
- [Site Configuration](#site-configuration)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)
- [WebSocket Events](#websocket-events)

---

## Authentication

Most endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

**Token types:**
- **Access token** — Short-lived, used for API requests. Contains `userId`, `email`, `role`.
- **Refresh token** — Long-lived, used to obtain new access tokens.

**Middleware reference:**
| Middleware | Behavior |
|---|---|
| `authenticate` | Requires valid access token. Returns `401` if missing or invalid. |
| `fastify.auth` | Alias for `authenticate`. |
| `requireAdmin` | Must follow `authenticate`. Returns `403` if `role !== 'admin'`. |

---

## Health Check

> These endpoints are registered **outside** the `/api/v1` prefix.

### `GET /health`

Basic health check.

**Auth:** None

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 3600.5
}
```

### `GET /health/detailed`

Health check with database connectivity status.

**Auth:** None

**Response `200` / `503`:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "databaseTime": "2025-01-15T10:00:00.000Z"
  }
}
```

### `GET /health/ready`

Readiness probe for container orchestration. Checks database connectivity.

**Auth:** None

**Response `200`:**
```json
{ "ready": true }
```

**Response `503`:**
```json
{ "ready": false, "error": "connection refused" }
```

### `GET /health/live`

Liveness probe for container orchestration.

**Auth:** None

**Response `200`:**
```json
{ "alive": true }
```

---

## Auth

### `POST /auth/register`

Register a new user account.

**Auth:** None
**Rate limit:** 10 req/min per IP

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | Yes | Valid email, max 255 chars |
| `password` | string | Yes | 8-128 chars, must pass strength validation |
| `fullName` | string | No | Max 255 chars |

**Response `201`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2025-01-15T10:00:00.000Z"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

**Errors:**
| Status | Condition |
|---|---|
| `400` | Invalid email or weak password |
| `403` | Registration is disabled (`REGISTRATION_DISABLED`) |
| `409` | Email already registered |

**Notes:**
- The first registered user is automatically promoted to `admin` role.
- Registration can be disabled via site configuration.

---

### `POST /auth/login`

Authenticate with email and password.

**Auth:** None
**Rate limit:** 10 req/min per IP

**Request body:**
| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2025-01-15T10:00:00.000Z"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

**Errors:**
| Status | Condition |
|---|---|
| `401` | Invalid credentials or account locked |

**Notes:**
- Account locks after 5 failed attempts for 15 minutes.

---

### `POST /auth/refresh`

Exchange a refresh token for a new access token.

**Auth:** None

**Request body:**
| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

**Response `200`:**
```json
{
  "accessToken": "jwt..."
}
```

**Errors:** `401` if token is invalid or expired.

---

### `POST /auth/logout`

Revoke a specific refresh token.

**Auth:** None

**Request body:**
| Field | Type | Required |
|---|---|---|
| `refreshToken` | string | Yes |

**Response `200`:**
```json
{ "success": true }
```

---

### `POST /auth/logout-all`

Revoke all refresh tokens for the authenticated user.

**Auth:** Required

**Response `200`:**
```json
{ "success": true }
```

---

### `GET /auth/me`

Get the currently authenticated user's profile.

**Auth:** Required

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

## Users

### `GET /users/profile`

Get the authenticated user's profile.

**Auth:** Required

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "user",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### `PATCH /users/profile`

Update the authenticated user's profile.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `fullName` | string | No | Max 255 chars |
| `email` | string | No | Valid email, max 255 chars |

**Response `200`:** Same shape as `GET /users/profile`.

**Errors:** `400` if email already in use.

---

### `POST /users/profile/password`

Change the authenticated user's password.

**Auth:** Required
**Rate limit:** 5 req/15 min per IP

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `currentPassword` | string | Yes | |
| `newPassword` | string | Yes | 8-128 chars, must pass strength validation |

**Response `200`:**
```json
{ "message": "Password updated successfully" }
```

**Errors:**
| Status | Condition |
|---|---|
| `400` | Current password incorrect or new password too weak |

---

## Admin - Users

> All endpoints require `admin` role.

### `GET /admin/users`

List all users with pagination and search.

**Auth:** Admin

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 50 | Results per page |
| `offset` | integer | 0 | Pagination offset |
| `search` | string | `""` | Search by email or name (ILIKE) |

**Response `200`:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

---

### `GET /admin/users/:userId`

Get a specific user's profile.

**Auth:** Admin

**Response `200`:** Same user shape as above.

**Errors:** `404` if user not found.

---

### `POST /admin/users`

Create a new user.

**Auth:** Admin

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | Yes | Valid email, max 255 chars |
| `password` | string | Yes | 8-128 chars |
| `fullName` | string | No | Max 255 chars |
| `role` | string | No | `"user"` (default) or `"admin"` |

**Response `201`:** User object.

**Errors:** `400` if email exists or password too weak.

---

### `PATCH /admin/users/:userId`

Update a user's profile and/or role.

**Auth:** Admin

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `fullName` | string | No | Max 255 chars |
| `email` | string | No | Valid email, max 255 chars |
| `role` | string | No | `"user"` or `"admin"` |
| `password` | string | No | 8-128 chars |

**Response `200`:** Updated user object.

**Errors:**
| Status | Condition |
|---|---|
| `400` | Cannot remove last admin, email in use, or no fields to update |
| `404` | User not found |

---

### `DELETE /admin/users/:userId`

Delete a user account.

**Auth:** Admin

**Response:** `204 No Content`

**Errors:**
| Status | Condition |
|---|---|
| `400` | Cannot delete own account or last admin |
| `404` | User not found |

---

### `POST /admin/users/:userId/unlock`

Unlock a locked user account and reset failed login attempts.

**Auth:** Admin

**Response `200`:**
```json
{ "message": "Account unlocked successfully" }
```

**Errors:** `404` if user not found.

---

## Trips

### `POST /trips`

Create a new trip.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | Yes | 1-255 chars |
| `destination` | string | No | Max 255 chars |
| `startDate` | string | No | ISO date (`YYYY-MM-DD`) |
| `endDate` | string | No | ISO date (`YYYY-MM-DD`), must be >= `startDate` |
| `budget` | number\|null | No | >= 0 |
| `currency` | string | No | Max 3 chars (e.g. `"USD"`, `"EUR"`) |
| `timezone` | string | No | Max 50 chars (e.g. `"UTC"`, `"Europe/Paris"`) |
| `description` | string\|null | No | |
| `destinationData` | object\|null | No | Geocoding result (see below) |
| `coverImageAttribution` | object\|null | No | Image attribution (see below) |

**`destinationData` shape:**
```json
{
  "place_id": 123456,
  "display_name": "Paris, Ile-de-France, France",
  "lat": 48.8566,
  "lon": 2.3522,
  "type": "city",
  "address": {},
  "validated": true
}
```

**`coverImageAttribution` shape:**
```json
{
  "source": "pexels",
  "photographer": "John Doe",
  "photographer_url": "https://...",
  "photo_id": 12345,
  "photo_url": "https://..."
}
```
`source` enum: `"pexels"`, `"user_upload"`, `"placeholder"`

**Response `201` (Trip object):**
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "ownerEmail": "user@example.com",
  "ownerName": "John Doe",
  "name": "Trip to Paris",
  "destination": "Paris",
  "startDate": "2025-06-01",
  "endDate": "2025-06-10",
  "budget": 2000,
  "currency": "EUR",
  "timezone": "Europe/Paris",
  "description": "Summer vacation",
  "coverImageUrl": "/uploads/covers/uuid-12345.jpg",
  "destinationData": { "...": "..." },
  "coverImageAttribution": { "...": "..." },
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "userRole": "owner"
}
```

**Notes:**
- A cover image is automatically fetched from Pexels when a destination is provided.

---

### `GET /trips`

List all trips the authenticated user has access to (as owner or trip buddy).

**Auth:** Required

**Response `200`:** Array of Trip objects. Ordered by `startDate DESC NULLS LAST`, `createdAt DESC`.

---

### `GET /trips/:id`

Get a specific trip.

**Auth:** Required (owner or accepted trip buddy)

**Response `200`:** Trip object.

**Errors:** `404` if not found, `403` if no access.

---

### `PATCH /trips/:id`

Update a trip. Only the trip owner can update.

**Auth:** Required (owner only)

**Request body:** Same fields as create (all optional).

**Response `200`:** Updated Trip object.

---

### `DELETE /trips/:id`

Delete a trip and all associated data. Only the trip owner can delete.

**Auth:** Required (owner only)

**Response:** `204 No Content`

---

### `GET /trips/:id/stats`

Get statistics for a trip.

**Auth:** Required (owner or trip buddy)

**Response `200`:**
```json
{
  "activity_count": 12,
  "trip_buddy_count": 3,
  "total_expenses": "1250.00"
}
```

---

### `POST /trips/:id/cover-image`

Upload a custom cover image for a trip.

**Auth:** Required
**Content-Type:** `multipart/form-data`

**Request:** File upload (image). Max 5MB.

**Response `200`:**
```json
{
  "message": "Cover image uploaded successfully",
  "coverImageUrl": "/uploads/cover-images/processed-filename.jpg",
  "trip": { "...": "Trip object" }
}
```

**Notes:** Image is automatically resized to 1200x630 JPEG at 85% quality.

---

### `DELETE /trips/:id/cover-image`

Remove the cover image from a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "trip": { "...": "Trip object with coverImageUrl: null" }
}
```

---

### `POST /trips/:id/optimize-route`

Optimize the order of trip activities using nearest-neighbor algorithm.

**Auth:** Required

**Response `200`:**
```json
{
  "message": "Route optimized successfully",
  "totalDistance": 42.5,
  "totalTravelTime": 85,
  "optimizedActivities": [
    { "id": "uuid", "title": "Visit Eiffel Tower", "sortOrder": 0, "latitude": 48.8584, "longitude": 2.2945 }
  ]
}
```

---

### `POST /trips/:id/calculate-distance`

Calculate distance between two activities.

**Auth:** Required

**Request body:**
| Field | Type | Required |
|---|---|---|
| `activityId1` | string (UUID) | Yes |
| `activityId2` | string (UUID) | Yes |

**Response `200`:**
```json
{
  "distance": 3.2,
  "duration": 6.4
}
```

---

## Activities

### `POST /trips/:tripId/activities`

Create a new activity for a trip.

**Auth:** Required (owner or editor)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | string | Yes | See valid types below, or `custom:<uuid>` |
| `title` | string | Yes | 1-255 chars |
| `description` | string | No | |
| `location` | string | No | Max 255 chars |
| `latitude` | number | No | -90 to 90 |
| `longitude` | number | No | -180 to 180 |
| `startTime` | string\|null | No | ISO 8601 datetime |
| `endTime` | string\|null | No | ISO 8601 datetime, must be >= `startTime` |
| `orderIndex` | integer | No | >= 0 |
| `metadata` | object | No | Arbitrary JSON |

**Valid activity types:**
`hotel`, `rental`, `bus`, `car`, `cruise`, `ferry`, `flight`, `train`, `bar`, `restaurant`, `market`, `monument`, `museum`, `park`, `shopping`, `sightseeing`, `accommodation`, `transportation`, `meeting`, `event`, or `custom:<uuid>` (custom category reference).

**Response `201` (Activity object):**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "type": "restaurant",
  "title": "Dinner at Le Jules Verne",
  "description": "Fine dining at the Eiffel Tower",
  "location": "Eiffel Tower, Paris",
  "latitude": 48.8584,
  "longitude": 2.2945,
  "startTime": "2025-06-05T19:00:00.000Z",
  "endTime": "2025-06-05T21:00:00.000Z",
  "orderIndex": 0,
  "metadata": {},
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "createdBy": "uuid",
  "createdByName": "John Doe",
  "createdByEmail": "user@example.com",
  "updatedBy": null,
  "updatedByName": null,
  "updatedByEmail": null
}
```

**WebSocket broadcast:** `activity:created`

---

### `GET /trips/:tripId/activities`

List all activities for a trip. Ordered by `orderIndex ASC`, `startTime ASC`.

**Auth:** Required (owner or trip buddy)

**Response `200`:** Array of Activity objects.

---

### `GET /activities/:id`

Get a single activity by ID.

**Auth:** Required (must have access to parent trip)

**Response `200`:** Activity object.

---

### `PATCH /activities/:id`

Update an activity. Fields are the same as create (all optional).

**Auth:** Required (owner or editor)

**Response `200`:** Updated Activity object.

**WebSocket broadcast:** `activity:updated`

---

### `DELETE /activities/:id`

Delete an activity.

**Auth:** Required (owner or editor)

**Response:** `204 No Content`

**WebSocket broadcast:** `activity:deleted`

---

### `POST /trips/:tripId/activities/reorder`

Reorder activities within a trip.

**Auth:** Required (owner or editor)

**Request body:**
```json
{
  "order": [
    { "id": "activity-uuid-1", "orderIndex": 0 },
    { "id": "activity-uuid-2", "orderIndex": 1 },
    { "id": "activity-uuid-3", "orderIndex": 2 }
  ]
}
```

**Response `200`:** Array of updated Activity objects.

**WebSocket broadcast:** `activity:reordered`

---

## Expenses

### `POST /trips/:tripId/expenses`

Create a new expense with optional splits.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `amount` | number | Yes | >= 0.01 |
| `category` | string | Yes | See valid categories |
| `expenseDate` | string | Yes | ISO date (`YYYY-MM-DD`) |
| `payerId` | string (UUID) | No | Defaults to authenticated user |
| `activityId` | string (UUID) | No | Link to an activity |
| `currency` | string | No | Max 3 chars, defaults to trip currency |
| `description` | string | No | Max 500 chars |
| `splitEvenly` | boolean | No | Auto-split among all participants |
| `splits` | array | No | Manual split definitions |

**Valid expense categories:** `accommodation`, `transportation`, `food`, `activities`, `shopping`, `entertainment`, `settlement`, `other`

**`splits` array items:**
| Field | Type | Required |
|---|---|---|
| `userId` | string (UUID) | Yes |
| `amount` | number | No (>= 0) |
| `percentage` | number | No (0-100) |

Split amounts must sum to the total expense amount (1-cent tolerance for rounding).

**Response `201` (Expense object):**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "payerId": "uuid",
  "payerEmail": "user@example.com",
  "payerName": "John Doe",
  "activityId": null,
  "amount": 120.00,
  "currency": "EUR",
  "category": "food",
  "description": "Group dinner",
  "expenseDate": "2025-06-05",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "splits": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "amount": 60.00,
      "percentage": 50,
      "settled": false,
      "settledAt": null
    }
  ]
}
```

---

### `GET /trips/:tripId/expenses`

List all expenses for a trip with optional filters.

**Auth:** Required

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by expense category |
| `startDate` | string | Filter by date range start |
| `endDate` | string | Filter by date range end |

**Response `200`:** Array of Expense objects.

---

### `GET /trips/:tripId/expenses/summary`

Get expense summary and budget status for a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "budget": 2000.00,
  "totalSpent": 1650.00,
  "percentUsed": 82.5,
  "budgetStatus": "warning",
  "budgetWarning": "You have used 82.5% of your budget"
}
```

`budgetStatus` values: `"ok"` (< 80%), `"warning"` (80-99%), `"exceeded"` (>= 100%), or `null` (no budget set).

---

### `GET /trips/:tripId/expenses/balances`

Get balance sheet showing who owes whom.

**Auth:** Required

**Response `200`:**
```json
{
  "participants": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "totalPaid": 500.00,
      "totalOwed": 250.00,
      "settlementsPaid": 0,
      "settlementsReceived": 0,
      "netBalance": 250.00
    }
  ]
}
```

Positive `netBalance` = others owe this person. Negative = this person owes others.

---

### `GET /trips/:tripId/expenses/:expenseId`

Get a single expense with its splits.

**Auth:** Required

**Response `200`:** Expense object.

---

### `PATCH /trips/:tripId/expenses/:expenseId`

Update an expense. Only the payer or trip owner can update.

**Auth:** Required (payer or owner)

**Request body:** Same fields as create (all optional). Can also update `activityId` (set to `null` to unlink).

**Response `200`:** Updated Expense object.

---

### `DELETE /trips/:tripId/expenses/:expenseId`

Delete an expense. Only the payer or trip owner can delete.

**Auth:** Required (payer or owner)

**Response:** `204 No Content`

---

### `POST /trips/:tripId/expenses/splits/:splitId/settle`

Mark an expense split as settled.

**Auth:** Required (split user or expense payer)

**Response `200`:** Updated split object.

---

### `POST /trips/:tripId/expenses/splits/:splitId/unsettle`

Mark an expense split as unsettled.

**Auth:** Required (split user or expense payer)

**Response `200`:** Updated split object.

---

## Suggestions

### `POST /trips/:tripId/suggestions`

Create a new activity suggestion for group voting.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `activityType` | string | Yes | See valid types |
| `title` | string | Yes | 1-255 chars |
| `description` | string | No | |
| `location` | string | No | Max 255 chars |
| `latitude` | number | No | -90 to 90 |
| `longitude` | number | No | -180 to 180 |
| `startTime` | string\|null | No | ISO 8601 or datetime-local format |
| `endTime` | string\|null | No | ISO 8601 or datetime-local format |

**Valid suggestion activity types:** `flight`, `train`, `accommodation`, `restaurant`, `attraction`, `transportation`, `meeting`, `event`, `other`

**Response `201` (Suggestion object):**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "suggestedByUserId": "uuid",
  "activityType": "restaurant",
  "title": "Try the local ramen shop",
  "description": "Highly rated on Google Maps",
  "location": "Shibuya, Tokyo",
  "latitude": 35.6595,
  "longitude": 139.7004,
  "startTime": null,
  "endTime": null,
  "votes": [],
  "status": "pending",
  "resolvedAt": null,
  "resolvedBy": null,
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "suggestedByEmail": "user@example.com",
  "suggestedByName": "John Doe",
  "tripName": "Tokyo Trip",
  "destination": "Tokyo",
  "upvotes": 0,
  "downvotes": 0,
  "totalVotes": 0
}
```

**WebSocket broadcast:** `suggestion:created`

---

### `GET /trips/:tripId/suggestions`

List suggestions for a trip with optional status filter.

**Auth:** Required

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter: `"pending"`, `"accepted"`, or `"rejected"` |

**Response `200`:** Array of Suggestion objects.

---

### `GET /suggestions/:id`

Get a single suggestion.

**Auth:** Required

**Response `200`:** Suggestion object.

---

### `POST /suggestions/:id/vote`

Vote on a pending suggestion.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `vote` | string | Yes | `"up"`, `"down"`, or `"neutral"` |

**Response `200`:** Updated Suggestion object with vote tallies.

**Notes:** Voting `"neutral"` effectively removes your vote. Only pending suggestions can be voted on.

**WebSocket broadcast:** `suggestion:voted`

---

### `POST /suggestions/:id/accept`

Accept a suggestion and create an activity from it.

**Auth:** Required (owner or editor)

**Response `200`:**
```json
{
  "suggestion": { "...": "Suggestion object with status: accepted" },
  "activity": { "...": "Newly created Activity object" }
}
```

**WebSocket broadcast:** `suggestion:accepted`

---

### `POST /suggestions/:id/reject`

Reject a suggestion.

**Auth:** Required (owner or editor)

**Response `200`:** Updated Suggestion object with `status: "rejected"`.

**WebSocket broadcast:** `suggestion:rejected`

---

### `PATCH /suggestions/:id`

Update a pending suggestion. Only the creator can update.

**Auth:** Required (creator only, must be pending)

**Request body:** Same fields as create (all optional).

**Response `200`:** Updated Suggestion object.

**WebSocket broadcast:** `suggestion:updated`

---

### `DELETE /suggestions/:id`

Delete a suggestion. Creator can delete own; owner/editor can delete any.

**Auth:** Required

**Response:** `204 No Content`

**WebSocket broadcast:** `suggestion:deleted`

---

### `GET /trips/:tripId/suggestions/stats`

Get suggestion statistics for a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "total": 10,
  "pending": 5,
  "accepted": 3,
  "rejected": 2
}
```

---

## Trip Buddies

### `POST /trips/:tripId/trip-buddies`

Invite a user to collaborate on a trip.

**Auth:** Required (owner or editor)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | Yes | Valid email of an existing user |
| `role` | string | Yes | `"editor"` or `"viewer"` |

**Response `201` (TripBuddy object):**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "userId": "uuid",
  "role": "editor",
  "invitedBy": "uuid",
  "invitedAt": "2025-01-15T10:00:00.000Z",
  "acceptedAt": null,
  "email": "buddy@example.com",
  "fullName": "Jane Doe",
  "tripName": "Trip to Paris",
  "destination": "Paris",
  "startDate": "2025-06-01",
  "endDate": "2025-06-10",
  "ownerName": "John Doe",
  "invitedByName": "John Doe"
}
```

**Errors:**
| Status | Condition |
|---|---|
| `404` | Invitee email not found |
| `409` | User already invited or is the trip owner |

---

### `GET /trips/:tripId/trip-buddies`

List all collaborators for a trip (including pending invitations).

**Auth:** Required (must have trip access)

**Response `200`:** Array of TripBuddy objects.

---

### `GET /trip-buddies/invitations`

List pending invitations for the authenticated user.

**Auth:** Required

**Response `200`:** Array of TripBuddy objects where `acceptedAt` is `null`.

---

### `POST /trip-buddies/:id/accept`

Accept a collaboration invitation.

**Auth:** Required (must be the invited user)

**Response `200`:** Updated TripBuddy object with `acceptedAt` set.

---

### `PATCH /trip-buddies/:id`

Update a collaborator's role.

**Auth:** Required (owner or editor)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `role` | string | Yes | `"editor"` or `"viewer"` |

**Response `200`:** Updated TripBuddy object.

---

### `DELETE /trip-buddies/:id`

Remove a collaborator from a trip. Users can also remove themselves.

**Auth:** Required (owner, editor, or the buddy themselves)

**Response:** `204 No Content`

---

### `POST /trips/:tripId/leave`

Leave a trip as a collaborator (self-removal).

**Auth:** Required

**Response:** `204 No Content`

---

### `GET /trips/:tripId/trip-buddies/stats`

Get collaboration statistics for a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "total": 5,
  "accepted": 4,
  "pending": 1
}
```

---

### `GET /trips/:tripId/role`

Check the authenticated user's role on a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "role": "owner"
}
```

Possible values: `"owner"`, `"editor"`, `"viewer"`, or `null`.

---

## Lists

### `GET /list-templates`

Get available list templates.

**Auth:** Required

**Response `200`:**
```json
[
  { "id": "cold-weather", "title": "Cold Weather Packing", "type": "packing", "itemCount": 12 },
  { "id": "beach", "title": "Beach Vacation Packing", "type": "packing", "itemCount": 12 },
  { "id": "business", "title": "Business Trip Packing", "type": "packing", "itemCount": 12 },
  { "id": "camping", "title": "Camping Trip Packing", "type": "packing", "itemCount": 14 },
  { "id": "essentials", "title": "Travel Essentials", "type": "packing", "itemCount": 12 },
  { "id": "todo", "title": "Pre-Trip Checklist", "type": "todo", "itemCount": 12 }
]
```

---

### `GET /list-templates/:templateId`

Get a specific template with its items.

**Auth:** Required

**Response `200`:**
```json
{
  "id": "essentials",
  "title": "Travel Essentials",
  "type": "packing",
  "items": [
    { "text": "Passport/ID", "checked": false },
    { "text": "Wallet/money", "checked": false }
  ]
}
```

---

### `GET /trips/:tripId/lists`

List all lists for a trip with completion stats.

**Auth:** Required

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "tripId": "uuid",
    "title": "Packing List",
    "type": "packing",
    "items": [],
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "stats": {
      "total": 12,
      "checked": 5,
      "percentage": 42
    }
  }
]
```

---

### `POST /trips/:tripId/lists`

Create a new list.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | Yes | 1-255 chars |
| `type` | string | Yes | `"packing"`, `"todo"`, `"shopping"`, or `"custom"` |
| `items` | array | No | Initial items |

**Item shape:**
```json
{ "text": "Item name", "checked": false, "order": 0 }
```

**Response `201`:** List object.

---

### `POST /trips/:tripId/lists/from-template/:templateId`

Create a list pre-populated from a template.

**Auth:** Required

**Response `201`:** List object with template items.

---

### `GET /trips/:tripId/lists/:listId`

Get a specific list with stats.

**Auth:** Required

**Response `200`:** List object with `stats`.

---

### `PATCH /trips/:tripId/lists/:listId`

Update list title or type.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | No | 1-255 chars |
| `type` | string | No | `"packing"`, `"todo"`, `"shopping"`, or `"custom"` |

**Response `200`:** Updated List object.

---

### `DELETE /trips/:tripId/lists/:listId`

Delete a list.

**Auth:** Required

**Response:** `204 No Content`

---

### `PUT /trips/:tripId/lists/:listId/items`

Replace all items in a list.

**Auth:** Required

**Request body:**
```json
{
  "items": [
    { "text": "Item 1", "checked": false },
    { "text": "Item 2", "checked": true }
  ]
}
```

**Response `200`:** Updated List object.

---

### `POST /trips/:tripId/lists/:listId/items`

Add a single item to a list.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `text` | string | Yes | 1-500 chars |
| `checked` | boolean | No | Defaults to `false` |

**Response `201`:** Updated List object.

---

### `PATCH /trips/:tripId/lists/:listId/items/:itemId`

Toggle an item's checked status.

**Auth:** Required

**Request body:**
| Field | Type | Required |
|---|---|---|
| `checked` | boolean | Yes |

**Response `200`:** Updated List object.

---

### `DELETE /trips/:tripId/lists/:listId/items/:itemId`

Remove an item from a list.

**Auth:** Required

**Response `200`:** Updated List object.

---

### `POST /trips/:tripId/lists/:listId/reorder`

Reorder items in a list.

**Auth:** Required

**Request body:**
```json
{
  "itemIds": ["item-id-1", "item-id-2", "item-id-3"]
}
```

**Response `200`:** Updated List object.

---

## Documents

### `GET /trips/:tripId/documents`

List all documents for a trip with optional filters.

**Auth:** Required

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by document category |
| `activityId` | string (UUID) | Filter by linked activity |

**Response `200`:** Array of Document objects.

---

### `GET /trips/:tripId/documents/stats`

Get document statistics for a trip.

**Auth:** Required

**Response `200`:**
```json
{
  "categoryCounts": {
    "ticket": 3,
    "reservation": 2,
    "photo": 5
  },
  "storageUsage": 15728640,
  "totalDocuments": 10
}
```

---

### `POST /trips/:tripId/documents`

Upload a document.

**Auth:** Required
**Content-Type:** `multipart/form-data`

**Form fields** (text fields must come before the file):
| Field | Type | Required | Description |
|---|---|---|---|
| `category` | string | No | Default: `"other"`. See valid categories. |
| `description` | string | No | Max 1000 chars |
| `activityId` | string (UUID) | No | Link to an activity |
| `file` | file | Yes | The document file |

**Valid document categories:** `passport`, `visa`, `ticket`, `reservation`, `insurance`, `itinerary`, `photo`, `other`

**Response `201` (Document object):**
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "activityId": null,
  "uploadedBy": "uuid",
  "fileName": "boarding-pass.pdf",
  "fileSize": 524288,
  "fileType": "application/pdf",
  "category": "ticket",
  "description": "Flight to Paris",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z"
}
```

---

### `GET /trips/:tripId/documents/:documentId`

Get a document's metadata.

**Auth:** Required

**Response `200`:** Document object.

---

### `GET /trips/:tripId/documents/:documentId/download`

Download a document file.

**Auth:** Required

**Response `200`:** File stream with appropriate `Content-Type`, `Content-Disposition`, and `Content-Length` headers.

---

### `PATCH /trips/:tripId/documents/:documentId`

Update a document's metadata.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `category` | string | No | Valid document category |
| `description` | string\|null | No | Max 1000 chars |
| `activityId` | string\|null | No | UUID of activity to link, or `null` to unlink |

**Response `200`:** Updated Document object.

---

### `DELETE /trips/:tripId/documents/:documentId`

Delete a document (removes file from disk).

**Auth:** Required

**Response:** `204 No Content`

---

### `GET /trips/:tripId/activities/:activityId/documents`

List all documents linked to a specific activity.

**Auth:** Required

**Response `200`:** Array of Document objects.

---

## Reservations

### `GET /trips/:tripId/reservations`

List activities that are marked as reservations (have `metadata.isReservation: true`).

**Auth:** Required

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by reservation type. `"all"` for no filter. |

**Valid type filter values:** `hotel`, `rental`, `bus`, `car`, `cruise`, `ferry`, `flight`, `train`, `bar`, `restaurant`, `accommodation`, `transportation`, `event`, `other`, `all`

**Response `200`:**
```json
{
  "reservations": [
    {
      "id": "uuid",
      "tripId": "uuid",
      "type": "flight",
      "title": "Paris to Tokyo",
      "description": null,
      "location": "CDG Airport",
      "latitude": 49.0097,
      "longitude": 2.5479,
      "startTime": "2025-06-01T08:00:00.000Z",
      "endTime": "2025-06-01T22:00:00.000Z",
      "confirmationCode": "ABC123",
      "provider": "Air France",
      "reservationType": "one-way",
      "metadata": {},
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "grouped": {
    "hotel": [],
    "rental": [],
    "bus": [],
    "car": [],
    "cruise": [],
    "ferry": [],
    "flight": [{ "...": "..." }],
    "train": [],
    "bar": [],
    "restaurant": [],
    "accommodation": [],
    "transportation": [],
    "event": [],
    "other": []
  },
  "total": 1
}
```

---

## Export & Sharing

### `GET /trips/:tripId/export/pdf`

Export trip data as a PDF file.

**Auth:** Required (owner or trip buddy)

**Response `200`:** PDF file download (`Content-Type: application/pdf`).

---

### `GET /trips/:tripId/export/json`

Export trip data as a JSON file.

**Auth:** Required (owner or trip buddy)

**Response `200`:** JSON file download containing trip, activities, trip buddies, expenses, expense summary, and lists.

---

### `POST /trips/:tripId/share`

Create a share link for public read-only access.

**Auth:** Required (owner or trip buddy)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `expiresIn` | string | No | `"1d"`, `"7d"`, `"30d"`, or `"never"` (default) |

**Response `201`:**
```json
{
  "shareToken": {
    "id": "uuid",
    "token": "random-token-string",
    "permission": "view",
    "expiresAt": "2025-01-22T10:00:00.000Z",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "shareUrl": "http://localhost:5173/#/shared/random-token-string"
  }
}
```

---

### `GET /trips/:tripId/share`

List all share links for a trip.

**Auth:** Required (owner only)

**Response `200`:**
```json
{
  "shareTokens": [
    {
      "id": "uuid",
      "token": "random-token-string",
      "permission": "view",
      "expiresAt": null,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "createdBy": { "name": "John Doe", "email": "user@example.com" },
      "shareUrl": "http://localhost:5173/#/shared/random-token-string"
    }
  ]
}
```

---

### `PATCH /trips/:tripId/share/:tokenId`

Update a share link's permission.

**Auth:** Required (owner only)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `permission` | string | Yes | `"view"` |

**Response `200`:**
```json
{
  "shareToken": {
    "id": "uuid",
    "permission": "view",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### `DELETE /trips/:tripId/share/:tokenId`

Delete a share link.

**Auth:** Required (owner only)

**Response:** `204 No Content`

---

### `GET /shared/:token`

View a trip via a share link. No authentication required.

**Auth:** None

**Response `200`:**
```json
{
  "trip": {
    "id": "uuid",
    "name": "Trip to Paris",
    "destination": "Paris",
    "startDate": "2025-06-01",
    "endDate": "2025-06-10",
    "coverImageUrl": "/uploads/covers/...",
    "budget": 2000,
    "currency": "EUR",
    "owner": { "name": "John Doe" }
  },
  "activities": [
    {
      "id": "uuid",
      "title": "Visit Louvre",
      "type": "museum",
      "date": "2025-06-02",
      "startTime": "2025-06-02T10:00:00.000Z",
      "endTime": "2025-06-02T13:00:00.000Z",
      "location": "Rue de Rivoli, Paris",
      "latitude": 48.8606,
      "longitude": 2.3376,
      "notes": "Book skip-the-line tickets",
      "metadata": {},
      "orderIndex": 0
    }
  ],
  "tripBuddies": [
    { "name": "Jane Doe", "role": "editor" }
  ],
  "permission": "view",
  "expiresAt": null
}
```

**Errors:** `404` if token is invalid or expired.

---

## Categories

### `GET /categories`

Get the authenticated user's categories (defaults + custom).

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "defaults": {
      "activity": [{ "key": "hotel", "icon": "...", "i18nKey": "..." }],
      "expense": [],
      "document": []
    },
    "custom": {
      "activity": [{ "id": "uuid", "name": "Spa", "icon": "...", "isCustom": true, "ref": "custom:uuid" }],
      "expense": [],
      "document": []
    }
  }
}
```

---

### `GET /categories/defaults`

Get default categories only (no custom categories).

**Auth:** None

**Response `200`:**
```json
{
  "success": true,
  "data": { "activity": [], "expense": [], "document": [] }
}
```

---

### `POST /categories`

Create a custom category.

**Auth:** Required

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | Yes | 1-50 chars |
| `icon` | string | Yes | 1-10 chars (emoji) |
| `domain` | string | Yes | `"activity"`, `"reservation"`, `"expense"`, or `"document"` |

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Spa", "icon": "...", "domain": "activity", "isCustom": true, "ref": "custom:uuid" },
  "message": "Category created successfully"
}
```

**Notes:** Maximum 100 custom categories per user.

---

### `PUT /categories/:id`

Update a custom category.

**Auth:** Required (category owner)

**Request body:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | No | 1-50 chars |
| `icon` | string | No | 1-10 chars |

At least one field must be provided.

**Response `200`:**
```json
{
  "success": true,
  "data": { "...": "category" },
  "message": "Category updated successfully"
}
```

---

### `DELETE /categories/:id`

Delete a custom category. Items using it are reassigned to `"other"`.

**Auth:** Required (category owner)

**Response `200`:**
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "data": {
    "reassigned": {
      "expenses": 0,
      "activities": 2,
      "reservations": 0,
      "documents": 0
    }
  }
}
```

---

### `GET /categories/:id/usage`

Get usage count for a custom category.

**Auth:** Required (category owner)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "expenses": 0,
    "activities": 3,
    "reservations": 1,
    "documents": 0,
    "total": 4
  }
}
```

---

### `GET /trips/:tripId/categories`

Get categories for a trip (uses the trip owner's categories so collaborators see the same set).

**Auth:** Required

**Response `200`:** Same shape as `GET /categories`.

---

## Preferences

### `GET /preferences`

Get the authenticated user's preferences.

**Auth:** Required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "language": "en",
    "dateFormat": "mdy",
    "timeFormat": "12h",
    "distanceFormat": "mi"
  }
}
```

---

### `PUT /preferences`

Update user preferences. At least one field must be provided.

**Auth:** Required

**Request body:**
| Field | Type | Required | Valid values |
|---|---|---|---|
| `language` | string | No | `"en"`, `"fr"`, `"es"` |
| `dateFormat` | string | No | `"mdy"`, `"dmy"` |
| `timeFormat` | string | No | `"12h"`, `"24h"` |
| `distanceFormat` | string | No | `"mi"`, `"km"` |

**Response `200`:**
```json
{
  "success": true,
  "data": { "language": "fr", "dateFormat": "dmy", "timeFormat": "24h", "distanceFormat": "km" },
  "message": "Preferences saved successfully"
}
```

---

### `GET /preferences/languages`

Get the list of supported languages.

**Auth:** None

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "code": "en", "name": "English", "nativeName": "English" },
    { "code": "fr", "name": "French", "nativeName": "Fran\u00e7ais" },
    { "code": "es", "name": "Spanish", "nativeName": "Espa\u00f1ol" }
  ]
}
```

---

### `GET /preferences/defaults`

Get default preferences based on a locale.

**Auth:** None

**Query parameters:**
| Param | Type | Description |
|---|---|---|
| `locale` | string | Browser locale (e.g. `"en-US"`, `"fr-FR"`) |

**Response `200`:**
```json
{
  "success": true,
  "data": { "language": "fr", "dateFormat": "dmy", "timeFormat": "24h", "distanceFormat": "km" }
}
```

---

## Geocoding

### `GET /geocoding/search`

Search for destinations using OpenStreetMap Nominatim API.

**Auth:** None
**Rate limit:** 60 req/min

**Query parameters:**
| Param | Type | Required | Constraints | Default |
|---|---|---|---|---|
| `q` | string | Yes | Min 2 chars | |
| `limit` | integer | No | 1-10 | 5 |
| `language` | string | No | ISO 639-1 code | `"en"` |

**Response `200`:**
```json
{
  "results": [
    {
      "place_id": 123456,
      "display_name": "Paris, Ile-de-France, France",
      "lat": 48.8566,
      "lon": 2.3522,
      "type": "city",
      "address": {
        "city": "Paris",
        "state": "Ile-de-France",
        "country": "France",
        "country_code": "fr"
      },
      "validated": true
    }
  ],
  "cached": false
}
```

**Errors:**
| Status | Condition |
|---|---|
| `400` | Query too short |
| `429` | Rate limit exceeded |
| `503` | Nominatim service unavailable or timed out |

---

### `GET /geocoding/health`

Health check for the geocoding service.

**Auth:** None

**Response `200`:**
```json
{
  "status": "healthy",
  "cache": {
    "size": 42,
    "maxSize": 1000,
    "hitRate": 0.75
  }
}
```

---

## Routing

### `GET /routing`

Calculate a route between two geographic points.

**Auth:** None
**Rate limit:** 60 req/min

**Query parameters:**
| Param | Type | Required | Constraints |
|---|---|---|---|
| `fromLat` | number | Yes | -90 to 90 |
| `fromLng` | number | Yes | -180 to 180 |
| `toLat` | number | Yes | -90 to 90 |
| `toLng` | number | Yes | -180 to 180 |
| `mode` | string | Yes | `"walk"`, `"bike"`, `"drive"`, `"fly"`, `"boat"` |

**Response `200`:**
```json
{
  "distance": 3.2,
  "duration": 38.5,
  "geometry": [[2.3522, 48.8566], [2.2945, 48.8584]],
  "provider": "osrm",
  "cached": false
}
```

| Field | Unit | Description |
|---|---|---|
| `distance` | kilometers | Total route distance |
| `duration` | minutes | Estimated travel time |
| `geometry` | `[lng, lat][]` | GeoJSON coordinate array |
| `provider` | string | `"osrm"` (road routes) or `"haversine"` (straight-line) |

**Provider selection:**
| Mode | Provider |
|---|---|
| `walk`, `bike`, `drive` | OSRM (falls back to Haversine on error) |
| `fly`, `boat` | Haversine (great-circle distance) |

**Errors:**
| Status | Condition |
|---|---|
| `400` | Invalid coordinates or mode |
| `429` | Rate limit exceeded |
| `503` | Routing service unavailable |

---

### `GET /routing/health`

Health check for the routing service.

**Auth:** None

**Response `200`:**
```json
{
  "status": "healthy",
  "modes": ["walk", "bike", "drive", "fly", "boat"],
  "cache": {
    "size": 15,
    "maxSize": 500
  }
}
```

---

## Cover Images

### `POST /cover-images/fetch`

Fetch a cover image from Pexels for a destination.

**Auth:** None
**Rate limit:** 200 req/hour

**Request body:**
| Field | Type | Required | Description |
|---|---|---|---|
| `destination` | string | Yes | Destination name (min 1 char) |
| `tripId` | string (UUID) | Yes | Trip ID for the output filename |

**Response `200`:**
```json
{
  "url": "/uploads/covers/uuid-12345.jpg",
  "attribution": {
    "source": "pexels",
    "photographer": "Jane Doe",
    "photographerUrl": "https://www.pexels.com/@janedoe",
    "photoUrl": "https://www.pexels.com/photo/12345",
    "photoId": 12345
  },
  "source": "pexels"
}
```

**Errors:**
| Status | Condition |
|---|---|
| `404` | No images found for destination |
| `429` | Pexels rate limit exceeded |
| `503` | Pexels API not configured or timed out |

---

### `GET /cover-images/health`

Health check for the cover image service.

**Auth:** None

**Response `200`:**
```json
{
  "status": "healthy",
  "configured": true,
  "rateLimit": {
    "requestsInLastHour": 15,
    "maxRequestsPerHour": 200,
    "remaining": 185
  }
}
```

---

## Site Configuration

### `GET /site-config/public`

Get public site settings (no authentication required).

**Auth:** None

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "registrationEnabled": true
  }
}
```

---

### `GET /admin/site-config`

Get site configuration.

**Auth:** Admin

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "registrationEnabled": true
  }
}
```

---

### `PATCH /admin/site-config`

Update site configuration.

**Auth:** Admin

**Request body:**
| Field | Type | Required |
|---|---|---|
| `registrationEnabled` | boolean | No |

At least one field must be provided.

**Response `200`:**
```json
{
  "success": true,
  "data": { "registrationEnabled": false },
  "message": "Site configuration updated"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "errors": [
    { "field": "email", "message": "must be a valid email" }
  ]
}
```

The `errors` array is only present for validation errors.

### Error Status Codes

| Status | Error Type | Description |
|---|---|---|
| `400` | Validation Error | Request body/query/params failed validation |
| `401` | Authentication Error | Missing, invalid, or expired token |
| `403` | Authorization Error / Forbidden | Insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Resource already exists (e.g. duplicate email) |
| `429` | Rate Limit Exceeded | Too many requests |
| `500` | Internal Server Error | Unexpected server error |
| `503` | Service Unavailable | External service down (Nominatim, Pexels, OSRM) |

---

## Rate Limiting

Rate limits are applied per-client. Authenticated requests are identified by user ID; unauthenticated requests use the IP from `X-Forwarded-For`.

| Scope | Limit | Window |
|---|---|---|
| Global (all endpoints) | 100 requests | 1 minute |
| Auth routes (`/auth/*`) | 10 requests | 1 minute |
| Password routes | 5 requests | 15 minutes |
| Geocoding (`/geocoding/*`) | 60 requests | 1 minute |
| Routing (`/routing/*`) | 60 requests | 1 minute |
| Cover Images (`/cover-images/*`) | 200 requests | 1 hour |

**Environment variables:**
- `RATE_LIMIT_DISABLED=true` — Disable all rate limiting
- `DEBUG_RATE_LIMIT=true` — Log rate limit keys for debugging

When rate limited, the response includes a `Retry-After` header.

---

## WebSocket Events

Real-time updates are delivered via WebSocket at the `/ws` prefix. Clients join trip-specific rooms to receive live updates.

### Activity Events

| Event | Trigger | Payload |
|---|---|---|
| `activity:created` | Activity created | `{ type, activity, userId, timestamp }` |
| `activity:updated` | Activity updated | `{ type, activityId, activity, userId, timestamp }` |
| `activity:deleted` | Activity deleted | `{ type, activityId, userId, timestamp }` |
| `activity:reordered` | Activities reordered | `{ type, activities, userId, timestamp }` |

### Suggestion Events

| Event | Trigger | Payload |
|---|---|---|
| `suggestion:created` | Suggestion created | `{ type, suggestion, userId, timestamp }` |
| `suggestion:voted` | Vote cast | `{ type, suggestionId, suggestion, vote, userId, timestamp }` |
| `suggestion:accepted` | Suggestion accepted | `{ type, suggestionId, suggestion, activity, userId, timestamp }` |
| `suggestion:rejected` | Suggestion rejected | `{ type, suggestionId, suggestion, userId, timestamp }` |
| `suggestion:updated` | Suggestion updated | `{ type, suggestionId, suggestion, userId, timestamp }` |
| `suggestion:deleted` | Suggestion deleted | `{ type, suggestionId, userId, timestamp }` |
