# Real-Time Collaborative Rooms - Implementation Plan

## Context

Rishi's Crossword is currently single-player only. Users can sign in with Google and save progress to Neon PostgreSQL, but each user plays independently. We're adding **collaborative rooms** so multiple authenticated users can solve the same crossword together in real time, seeing each other's edits and cursors live.

**The critical constraint:** The app is deployed on **Vercel serverless**, which does NOT support WebSockets. Serverless functions are stateless and short-lived. This rules out a self-hosted WebSocket server and requires a third-party real-time service.

## Architecture Decision: Ably

**Chosen: [Ably](https://ably.com)** as the real-time messaging layer.

**Why Ably over alternatives:**

| Option | Verdict | Reason |
|--------|---------|--------|
| **Ably** | **Selected** | REST API for serverless publishing, WebSocket for clients, built-in presence, generous free tier (6M msgs/month, 200 connections), token auth |
| Pusher | Rejected | Smaller free tier (200k msgs/day, 100 connections) |
| PartyKit | Rejected | Requires separate Cloudflare deployment — adds operational complexity |
| Liveblocks | Rejected | 250 MAU limit on free tier, overkill for crossword cells |
| Supabase Realtime | Rejected | Would require switching away from Neon PostgreSQL |
| Custom polling/SSE | Rejected | Poor real-time UX, complex to implement correctly |

**How it works with Vercel serverless:**
- **Backend (serverless):** Uses Ably REST API to generate auth tokens and publish server-originated events. No persistent connections needed.
- **Frontend (browser):** Uses Ably Realtime SDK to maintain WebSocket connections directly to Ably's infrastructure. Publishes cell edits, subscribes to others' edits, tracks presence.
- **Database (Neon):** Stores room state for persistence and late-joiner recovery.

## State Consistency Strategy

**Last-write-wins** — no CRDTs or operational transforms needed because:
- Each crossword cell is a single character, independently editable
- Two users editing the same cell simultaneously is rare and low-stakes (it's cooperative)
- Cell updates are idempotent: "set cell (2,3) to 'A'" is the same regardless of order
- Cursor/selection data is ephemeral (presence API handles it)

## Database Schema

### `rooms` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| code | VARCHAR(6) | Unique, indexed — join code (e.g., "ABC123") |
| puzzle_id | VARCHAR(20) | e.g., "2018-12-25" |
| puzzle_data | JSONB | Full puzzle object (so room is self-contained) |
| user_grid | JSONB | Shared grid state `[["0,0","A"],["0,1","B"]]` |
| checked_cells | JSONB | Shared check marks `[["0,0",true]]` |
| accumulated_seconds | INTEGER | Timer seconds from previous runs (default 0) |
| timer_started_at | TIMESTAMPTZ | When timer was last started (null if paused) |
| is_complete | BOOLEAN | Default false |
| is_paused | BOOLEAN | Default true (starts paused until first edit) |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | Default NOW() |
| updated_at | TIMESTAMPTZ | Default NOW() |
| max_members | INTEGER | Default 4 |
| expires_at | TIMESTAMPTZ | Default NOW() + 24 hours |

### `room_members` table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| room_id | UUID | FK → rooms.id, ON DELETE CASCADE |
| user_id | UUID | FK → users.id, ON DELETE CASCADE |
| color | VARCHAR(7) | Hex color for cursor (e.g., "#4A90D9") |
| display_name | VARCHAR(255) | User's name |
| joined_at | TIMESTAMPTZ | Default NOW() |

**Unique constraint:** `(room_id, user_id)` — one membership per user per room

## Shared Timer Design

Instead of syncing timer ticks in real-time (wasteful), store timing data in the room and let each client compute elapsed time locally:

```
elapsed = accumulated_seconds + (is_paused ? 0 : (now - timer_started_at))
```

- **Pause:** `accumulated_seconds += (now - timer_started_at)`, set `timer_started_at = null`, `is_paused = true`
- **Resume:** `timer_started_at = now`, `is_paused = false`
- **Toggle:** Broadcast `timer_toggle` event via Ably, update DB

## Room Code Generation

6-character uppercase alphanumeric, excluding ambiguous characters (0/O, 1/I/L):
- Character set: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (30 chars)
- Combinations: 30^6 = ~729 million
- Generated server-side, checked for uniqueness

## User Color Palette

Assigned in join order from a 4-color palette (max 4 users per room):
```
['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12']
```

## API Endpoints

### Rooms (`/api/rooms`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/rooms` | Yes | Create room for a puzzle_id → returns room code |
| GET | `/api/rooms/{code}` | Yes | Get room info + members list |
| POST | `/api/rooms/{code}/join` | Yes | Join room → returns member info + color |
| POST | `/api/rooms/{code}/leave` | Yes | Leave room |
| POST | `/api/rooms/{code}/token` | Yes | Get Ably auth token (member only) |
| GET | `/api/rooms/{code}/state` | Yes | Get current grid state (for late joiners) |
| PUT | `/api/rooms/{code}/state` | Yes | Persist current grid state (debounced from client) |

## Ably Auth Flow

1. User joins room via `POST /api/rooms/{code}/join`
2. User requests Ably token via `POST /api/rooms/{code}/token`
3. Backend validates JWT + room membership
4. Backend calls Ably REST API to generate a token with capabilities scoped to channel `room:{code}`
5. Frontend uses token to connect Ably Realtime client
6. Token auto-refreshes via callback that hits `/token` endpoint again

## Real-Time Message Protocol

### Channel: `room:{code}` (e.g., `room:ABC123`)

All events include a `timestamp` (epoch ms) for debugging, replay logs, and conflict reasoning.

**Cell edit** (most frequent):
```json
{ "type": "cell_edit", "row": 2, "col": 3, "value": "A", "userId": "uuid", "timestamp": 1710000000 }
```

**Check cell:**
```json
{ "type": "check_cell", "row": 2, "col": 3, "isCorrect": false, "userId": "uuid", "timestamp": 1710000000 }
```

**Clear checks:**
```json
{ "type": "clear_checks", "userId": "uuid", "timestamp": 1710000000 }
```

**Timer toggle:**
```json
{ "type": "timer_toggle", "isPaused": false, "accumulatedSeconds": 42, "startedAt": "2024-01-01T00:00:00Z", "userId": "uuid", "timestamp": 1710000000 }
```

**Puzzle complete:**
```json
{ "type": "puzzle_complete", "userId": "uuid", "timestamp": 1710000000 }
```

**State sync** (full state, used for late joiners or recovery):
```json
{ "type": "state_sync", "userGrid": [["0,0","A"]], "checkedCells": [["0,0",true]], "accumulatedSeconds": 120, "isComplete": false }
```

### Client-Side Rate Limiting

To prevent spam, the frontend enforces a soft rate limit of **max 20 cell edits per second per client**. Implemented as a simple sliding window counter in the `useAbly` hook — if the limit is exceeded, edits are queued and flushed on the next tick. This is purely client-side (no server enforcement needed for MVP).

### Presence Data (via Ably Presence API)
```json
{
  "userId": "uuid",
  "displayName": "Rishi",
  "color": "#4A90D9",
  "selection": { "row": 2, "col": 3, "direction": "across" }
}
```

Presence updates automatically when users enter/leave channel. Selection updates published via `presence.update()`.

## Late Joiner Strategy

1. Subscribe to Ably channel (start receiving live events)
2. Fetch current state from `GET /api/rooms/{code}/state`
3. Apply fetched state to local PuzzleContext
4. From this point, apply incoming Ably events on top
5. Any events received between subscribe and fetch are fine — cell edits are idempotent (last-write-wins)

## Frontend Architecture

### New TypeScript Types (`frontend/src/types/room.ts`)
```typescript
interface Room {
  id: string;
  code: string;
  puzzleId: string;
  members: RoomMember[];
  isComplete: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

interface RoomMember {
  userId: string;
  displayName: string;
  color: string;
  joinedAt: string;
}

interface RoomPresence {
  userId: string;
  displayName: string;
  color: string;
  selection: Selection | null;
}

type RoomEvent =
  | { type: 'cell_edit'; row: number; col: number; value: string; userId: string; timestamp: number }
  | { type: 'check_cell'; row: number; col: number; isCorrect: boolean; userId: string; timestamp: number }
  | { type: 'clear_checks'; userId: string; timestamp: number }
  | { type: 'timer_toggle'; isPaused: boolean; accumulatedSeconds: number; startedAt: string | null; userId: string; timestamp: number }
  | { type: 'puzzle_complete'; userId: string; timestamp: number }
  | { type: 'state_sync'; userGrid: [string, string][]; checkedCells: [string, boolean][]; accumulatedSeconds: number; isComplete: boolean }
```

### State Management Strategy

**Key insight:** PuzzleContext's reducer already handles all needed actions (`SET_CELL_VALUE`, `CHECK_CELL`, etc.). RoomContext wraps PuzzleContext and:

1. **Intercepts outgoing dispatches** — when user edits a cell locally, also publish to Ably
2. **Receives incoming Ably events** — dispatch them to PuzzleContext so the grid updates
3. **Manages room-specific state** — room info, members, presence, Ably connection

PuzzleContext gets a new `isCollaborative` flag and exposes a `collaborativeDispatch` callback that RoomContext can set. When `isCollaborative` is true:
- Cell edits also broadcast via Ably
- Timer uses room's shared timer instead of local timer
- Saves go to room state (not personal saves)

### Cursor Rendering

Other users' selections rendered as colored borders on cells:
- Each remote user has a color from the palette
- Their selected cell gets a colored border (2-3px, their color)
- Their highlighted word gets a subtle colored background tint
- A small name label appears near their cursor cell

## Files to Create

### Backend (4 new files)
1. **`backend/app/db/models.py`** — Add `Room` and `RoomMember` models (extend existing file)
2. **`backend/app/services/room_service.py`** — Room CRUD, code generation, Ably token generation
3. **`backend/app/services/ably_service.py`** — Ably REST client wrapper
4. **`backend/app/api/rooms.py`** — Rooms router with all endpoints

### Frontend (7 new files)
1. **`frontend/src/types/room.ts`** — Room, RoomMember, RoomEvent types
2. **`frontend/src/api/roomsApi.ts`** — Room API calls
3. **`frontend/src/hooks/useAbly.ts`** — Ably connection + channel management hook
4. **`frontend/src/context/RoomContext.tsx`** — Room state provider, Ably integration, dispatch interception
5. **`frontend/src/components/Room/CreateRoom.tsx`** — Create room modal/UI
6. **`frontend/src/components/Room/JoinRoom.tsx`** — Join room by code UI
7. **`frontend/src/components/Room/RoomBar.tsx`** — Room status bar (members, colors, room code display)

## Files to Modify

### Backend (3 files)
1. **`backend/app/config.py`** — Add `ABLY_API_KEY` setting
2. **`backend/app/main.py`** — Register `rooms_router`
3. **`api/requirements.txt`** — Add `ably>=2.0.0`

### Frontend (5 files)
1. **`frontend/src/context/PuzzleContext.tsx`** — Add `isCollaborative` flag, `collaborativeDispatch` callback, shared timer mode
2. **`frontend/src/components/Grid/Grid.tsx`** — Render remote cursors from RoomContext presence data
3. **`frontend/src/components/Grid/Cell.tsx`** — Accept `remoteCursors` prop for colored borders
4. **`frontend/src/App.tsx`** — Add room UI (Create/Join buttons, RoomBar), wrap with RoomProvider
5. **`frontend/src/main.tsx`** — Add RoomProvider to provider tree

## Implementation Order

### Phase 1: Backend — Database + Room API
1. Add `Room` and `RoomMember` SQLAlchemy models to `db/models.py`
2. Add `ABLY_API_KEY` to `config.py`
3. Create `services/ably_service.py` — Ably REST client for token generation
4. Create `services/room_service.py` — Room CRUD (create, join, leave, get state, update state, generate code)
5. Create `api/rooms.py` — All room endpoints
6. Register rooms router in `main.py`
7. Add `ably` to `api/requirements.txt`

### Phase 2: Frontend — Room Management UI
8. Create `types/room.ts`
9. Create `api/roomsApi.ts`
10. Create `components/Room/CreateRoom.tsx` and `JoinRoom.tsx`
11. Add Create/Join room buttons to `App.tsx` header

### Phase 3: Frontend — Real-Time Integration
12. Install `ably` npm package
13. Create `hooks/useAbly.ts` — connection, channel subscribe, presence
14. Create `context/RoomContext.tsx` — room state, Ably events ↔ PuzzleContext dispatch
15. Modify `PuzzleContext.tsx` — add collaborative mode support
16. Wrap app with `RoomProvider` in `main.tsx`

### Phase 4: Frontend — Collaborative Grid
17. Modify `Grid.tsx` — render remote user cursors
18. Modify `Cell.tsx` — accept and render remote cursor styling
19. Create `components/Room/RoomBar.tsx` — room info display (code, members with colors)

### Phase 5: Shared Timer + Completion
20. Update timer logic in `PuzzleContext.tsx` for room mode (compute from `timer_started_at` + `accumulated_seconds`)
21. Broadcast `timer_toggle` events via Ably
22. Broadcast `puzzle_complete` event — trigger confetti for all clients
23. Debounced room state persistence to DB (every 5 seconds)

### Phase 6: Polish + Edge Cases
24. Handle Ably reconnection (auto-replay missed messages)
25. Handle room expiry (24h TTL, show "room expired" state)
26. Handle user disconnect (Ably presence auto-removes)
27. Add room state to URL (query param `?room=ABC123` for shareability)
28. Single-player mode continues to work unchanged when not in a room

## Environment Variables

### Backend (Vercel)
```
ABLY_API_KEY=xxxxx.xxxxx:xxxxxxxxxxxxx  (from Ably dashboard)
```

### Frontend
No new env vars — Ably tokens come from the backend API.

## Edge Cases & Failure Handling

1. **Simultaneous cell edits:** Last-write-wins. Both users see the final value. No conflict.
2. **User disconnects:** Ably presence auto-removes after ~15s timeout. Room state persisted in DB. User can rejoin.
3. **All users disconnect:** Room persists in DB. Anyone with the code can rejoin and resume.
4. **Room expiry:** Rooms expire 24h after creation. Expired rooms return 410 Gone.
5. **Network flap:** Ably SDK handles auto-reconnection and message replay.
6. **Stale state on join:** Subscribe-then-fetch pattern ensures no missed events.
7. **Auth token expiry:** Ably auth callback re-requests token from backend automatically.
8. **Room creator leaves:** No "host" concept — room continues for all members.
9. **Single-player unaffected:** All room logic is opt-in. Default experience unchanged.

## Verification

1. **Single-player still works:** Play without room — saves, timer, checks, confetti all work as before
2. **Create room:** Click create → get 6-char code → room stored in DB
3. **Join room:** Enter code → added as member → Ably connected → see current grid state
4. **Real-time edits:** User A types letter → User B sees it appear instantly
5. **Cursors:** User A's selected cell shows colored border on User B's screen
6. **Shared timer:** Both users see same elapsed time, pause/resume syncs
7. **Completion:** One user checks puzzle → all correct → confetti on all screens
8. **Rejoin:** Close browser → reopen with room code → state restored from DB
9. **Multiple rooms:** Two different rooms running simultaneously, no cross-talk
