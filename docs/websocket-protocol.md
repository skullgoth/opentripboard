# WebSocket Real-Time Collaboration Protocol

This document describes the WebSocket protocol used for real-time collaboration in OpenTripBoard.

## Connection Endpoint

```
ws://<host>/ws
```

Configured via the `VITE_WS_URL` environment variable on the frontend (defaults to `ws://localhost/ws`).

## Connection Lifecycle

```
Client                                    Server
  |                                         |
  |  ---- WebSocket connect --------------> |
  |                                         |
  |  ---- { type: "auth", token } --------> |  (must arrive within 10s)
  |                                         |
  |  <--- { type: "auth:success" } -------- |
  |                                         |
  |  ---- { type: "room:join", tripId } --> |
  |                                         |
  |  <--- { type: "room:joined", ... } ---- |
  |                                         |  presence:join broadcast
  |  <--- activity/suggestion messages ---> |  to other users in room
  |                                         |
  |  ---- { type: "room:leave" } ---------> |
  |                                         |
  |  <--- { type: "room:left" } ----------- |  presence:leave broadcast
  |                                         |  to other users in room
```

### Authentication (10-second timeout)

The first message after connecting **must** be an `auth` message. The server closes the connection with code `1008` if:
- No `auth` message arrives within 10 seconds
- The JWT token is invalid or is not an access token (refresh tokens are rejected)

### Reconnection

The client retries up to **5 times** with linear backoff (`1000ms * attempt`). On successful reconnect, it automatically re-authenticates and rejoins the last trip room.

### Room Model

Each trip has a room identified by its `tripId`. A client can be in only one room at a time. Joining a new room automatically leaves the previous one. Rooms are cleaned up when the last user leaves.

## Broadcast Paths

Messages reach clients via two independent paths:

| Path | Trigger | Recipients | Used for |
|------|---------|------------|----------|
| **REST API route** | HTTP request creates/updates/deletes a resource | All users in room (sender included) | Authoritative data changes |
| **WebSocket handler** | Client sends a WS message | All users in room **except** sender | Peer-to-peer forwarding (typing, cursor) |

The REST API path is the primary broadcast mechanism. It includes the sender so that the sender's other browser tabs receive updates. The frontend uses **optimistic update deduplication** (see below) to avoid applying its own changes twice.

## Message Reference

All messages are JSON objects with a `type` field. Server-broadcast messages include `userId` (who triggered it) and `timestamp` (ISO 8601).

---

### Authentication

#### `auth` (Client -> Server)

```json
{ "type": "auth", "token": "<jwt_access_token>" }
```

#### `auth:success` (Server -> Client)

```json
{ "type": "auth:success", "userId": "<uuid>" }
```

#### `auth:error` (Server -> Client)

```json
{ "type": "auth:error", "message": "<error_description>" }
```

Connection is closed with code `1008` after this message.

---

### Room Management

#### `room:join` (Client -> Server)

```json
{ "type": "room:join", "tripId": "<uuid>" }
```

#### `room:joined` (Server -> Client)

```json
{
  "type": "room:joined",
  "tripId": "<uuid>",
  "activeUsers": ["<userId>", "..."]
}
```

`activeUsers` contains all user IDs currently in the room, including the joining user.

#### `room:leave` (Client -> Server)

```json
{ "type": "room:leave" }
```

#### `room:left` (Server -> Client)

```json
{ "type": "room:left" }
```

---

### Presence

Broadcast to **other users** in the room (sender excluded). Also sent automatically on WebSocket disconnect.

#### `presence:join` (Server -> Client)

```json
{
  "type": "presence:join",
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `presence:leave` (Server -> Client)

```json
{
  "type": "presence:leave",
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

---

### Activity Messages

Activity messages originate from REST API routes and are broadcast to all users in the room (sender included).

#### `activity:created`

**REST trigger:** `POST /api/v1/trips/:tripId/activities`

```json
{
  "type": "activity:created",
  "activity": { "id": "<uuid>", "tripId": "<uuid>", "title": "...", "..." : "..." },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

`activity` is the full activity object as returned by the REST API.

#### `activity:updated`

**REST trigger:** `PATCH /api/v1/activities/:id`
**WS client trigger:** Client sends `{ type: "activity:updated", activityId: "<uuid>", updates: {...} }` for optimistic updates. The server fetches the latest activity from the database before broadcasting.

```json
{
  "type": "activity:updated",
  "activityId": "<uuid>",
  "activity": { "..." : "..." },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `activity:deleted`

**REST trigger:** `DELETE /api/v1/activities/:id`
**WS client trigger:** Client sends `{ type: "activity:deleted", activityId: "<uuid>" }`

```json
{
  "type": "activity:deleted",
  "activityId": "<uuid>",
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `activity:reordered`

**REST trigger:** `POST /api/v1/trips/:tripId/activities/reorder`

```json
{
  "type": "activity:reordered",
  "activities": [
    { "id": "<uuid>", "orderIndex": 0 },
    { "id": "<uuid>", "orderIndex": 1 }
  ],
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

---

### Suggestion Messages

Suggestion messages originate from REST API routes and are broadcast to all users in the room (sender included).

#### `suggestion:created`

**REST trigger:** `POST /api/v1/trips/:tripId/suggestions`

```json
{
  "type": "suggestion:created",
  "suggestion": { "id": "<uuid>", "tripId": "<uuid>", "title": "...", "status": "pending", "..." : "..." },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `suggestion:voted`

**REST trigger:** `POST /api/v1/suggestions/:id/vote`
**WS client trigger:** Client sends `{ type: "suggestion:voted", suggestionId: "<uuid>", vote: "up"|"down"|"neutral" }`

```json
{
  "type": "suggestion:voted",
  "suggestionId": "<uuid>",
  "suggestion": { "..." : "..." },
  "vote": "up" | "down" | "neutral",
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `suggestion:accepted`

**REST trigger:** `POST /api/v1/suggestions/:id/accept`

```json
{
  "type": "suggestion:accepted",
  "suggestionId": "<uuid>",
  "suggestion": { "..." : "...", "status": "accepted" },
  "activity": { "..." : "..." },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

`activity` is the new activity created from the accepted suggestion.

#### `suggestion:rejected`

**REST trigger:** `POST /api/v1/suggestions/:id/reject`

```json
{
  "type": "suggestion:rejected",
  "suggestionId": "<uuid>",
  "suggestion": { "..." : "...", "status": "rejected" },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `suggestion:updated`

**REST trigger:** `PATCH /api/v1/suggestions/:id`

```json
{
  "type": "suggestion:updated",
  "suggestionId": "<uuid>",
  "suggestion": { "..." : "..." },
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

#### `suggestion:deleted`

**REST trigger:** `DELETE /api/v1/suggestions/:id`

```json
{
  "type": "suggestion:deleted",
  "suggestionId": "<uuid>",
  "userId": "<uuid>",
  "timestamp": "<ISO-8601>"
}
```

---

### Collaboration Messages

These are forwarded peer-to-peer via the WebSocket handler (sender excluded from broadcast). Currently registered but not actively sent by the frontend UI.

#### `typing:start` / `typing:stop` (Bidirectional)

```json
{
  "type": "typing:start",
  "userId": "<uuid>",
  "location": "<string>",
  "timestamp": "<ISO-8601>"
}
```

`location` identifies the UI context (e.g., `"activity-edit"`, `"suggestion-box"`).

#### `cursor:move` (Bidirectional)

```json
{
  "type": "cursor:move",
  "userId": "<uuid>",
  "position": { "elementId": "<string>", "offset": 0 },
  "timestamp": "<ISO-8601>"
}
```

Reserved for future collaborative editing features.

---

### Error Messages

#### `error` (Server -> Client)

```json
{ "type": "error", "message": "<description>" }
```

Known error messages:
- `"Authentication timeout"` - No auth message within 10 seconds
- `"Authentication required"` - First message was not `auth`
- `"Authentication failed"` - Invalid JWT token
- `"tripId is required"` - `room:join` missing `tripId`
- `"Must join a room first"` - Content message sent before joining a room
- `"Message type is required"` - Message missing `type` field
- `"Failed to handle <type>"` - Handler threw an exception
- `"Failed to process message"` - JSON parse error or unexpected exception

---

### Unknown Message Types

Any message with an unregistered `type` is broadcast to the room as-is (with `userId` and `timestamp` injected, sender excluded). This allows extending the protocol without backend changes.

## Optimistic Updates

The frontend uses optimistic UI updates for three operations to reduce perceived latency:

| Operation | Tracking key | Flow |
|-----------|-------------|------|
| Activity update | `activity:update:<activityId>` | Apply locally -> REST API -> WS broadcast -> deduplicate |
| Activity delete | `activity:delete:<activityId>` | Apply locally -> REST API -> WS broadcast -> deduplicate |
| Suggestion vote | `suggestion:vote:<suggestionId>` | Apply locally -> REST API -> WS broadcast -> deduplicate |

**How it works:**

1. The frontend applies the change to the UI immediately (optimistic).
2. It records a pending operation key in `RealTimeUpdateManager.pendingOperations`.
3. It calls the REST API.
4. The REST API broadcasts the change to all room users (including sender).
5. When the sender's WebSocket receives the broadcast, it checks `pendingOperations`. If a matching key exists, the message is discarded (already applied). Otherwise, it applies the update.
6. Pending operations expire after 5 seconds as a safety net.

## File Map

| File | Role |
|------|------|
| `backend/src/websocket/server.js` | Connection handler, auth handshake, room join/leave |
| `backend/src/websocket/handler.js` | Message type dispatcher, registered handlers |
| `backend/src/websocket/rooms.js` | Room state management, broadcast/send utilities |
| `backend/src/routes/activities.js` | REST routes that broadcast activity messages |
| `backend/src/routes/suggestions.js` | REST routes that broadcast suggestion messages |
| `frontend/src/services/websocket-client.js` | WebSocket client class (connect, auth, reconnect, send/receive) |
| `frontend/src/services/realtime-updates.js` | Real-time event manager, optimistic update coordination |
| `frontend/src/pages/trip-detail/realtime.js` | UI-level event subscriptions and presence indicator updates |

## Summary Table

| Message Type | Direction | Broadcast Source | Sender Included? |
|-------------|-----------|-----------------|------------------|
| `auth` | C -> S | - | - |
| `auth:success` | S -> C | - | - |
| `auth:error` | S -> C | - | - |
| `room:join` | C -> S | - | - |
| `room:joined` | S -> C | - | - |
| `room:leave` | C -> S | - | - |
| `room:left` | S -> C | - | - |
| `presence:join` | S -> C | WS server | No |
| `presence:leave` | S -> C | WS server | No |
| `activity:created` | S -> C | REST API | Yes |
| `activity:updated` | C -> S / S -> C | REST API + WS handler | REST: Yes, WS: No |
| `activity:deleted` | C -> S / S -> C | REST API + WS handler | REST: Yes, WS: No |
| `activity:reordered` | S -> C | REST API | Yes |
| `suggestion:created` | S -> C | REST API | Yes |
| `suggestion:voted` | C -> S / S -> C | REST API + WS handler | REST: Yes, WS: No |
| `suggestion:accepted` | S -> C | REST API | Yes |
| `suggestion:rejected` | S -> C | REST API | Yes |
| `suggestion:updated` | S -> C | REST API | Yes |
| `suggestion:deleted` | S -> C | REST API | Yes |
| `typing:start` | C -> S / S -> C | WS handler | No |
| `typing:stop` | C -> S / S -> C | WS handler | No |
| `cursor:move` | C -> S / S -> C | WS handler | No |
| `error` | S -> C | - | - |
