# Rishi's Crossword — Project Description

## Overview

A full-stack NYT-style crossword puzzle web app called **Rishi's Crossword**. It's a single-player app with ~15,000 historical NYT puzzles (1977–2018), Google OAuth authentication, and cloud save sync. Deployed on **Vercel** with a **Neon PostgreSQL** database.

---

## Repository Structure

```
nyt-crossword-clone/
├── vercel.json              # Root-level Vercel config (routes /api/* to Python, static to frontend)
├── api/
│   └── index.py             # Vercel serverless entry point — imports FastAPI app from backend/
├── backend/                 # Python FastAPI app
│   ├── app/
│   │   ├── main.py          # App factory, lifespan, CORS, router registration
│   │   ├── config.py        # Settings via env vars (DATABASE_URL, GOOGLE_CLIENT_ID, JWT_SECRET, etc.)
│   │   ├── dependencies.py  # get_db(), get_current_user(), get_optional_user() FastAPI deps
│   │   ├── models/puzzle.py # Pydantic models for puzzle data
│   │   ├── db/
│   │   │   ├── engine.py    # SQLAlchemy async engine (asyncpg), SSL handling for Neon
│   │   │   ├── init_db.py   # Creates tables on startup
│   │   │   └── models.py    # SQLAlchemy ORM: User, Save tables
│   │   ├── services/
│   │   │   ├── auth_service.py   # Google token verification + JWT create/verify
│   │   │   ├── puzzle_service.py # Fetches puzzles from GitHub archive, file cache
│   │   │   ├── cache_service.py  # File-based cache (year/month/day structure)
│   │   │   └── saves_service.py  # CRUD for user puzzle saves in PostgreSQL
│   │   └── api/
│   │       ├── puzzles.py   # Puzzle endpoints
│   │       ├── auth.py      # Auth endpoints
│   │       └── saves.py     # Save/load progress endpoints
│   └── requirements.txt
└── frontend/                # React + TypeScript + Vite app
    ├── vercel.json          # Frontend-specific Vercel config (SPA rewrites)
    └── src/
        ├── App.tsx          # Root component — loads puzzle, handles auth flow, migration prompt
        ├── context/
        │   ├── PuzzleContext.tsx  # useReducer state: puzzle, grid, selection, timer, saves
        │   └── AuthContext.tsx    # Google auth state, token management, SavesManager sync
        ├── components/
        │   ├── Grid/         # Grid.tsx, Cell.tsx — CSS Grid layout
        │   ├── Clues/        # ClueList.tsx, ClueItem.tsx — two-column Across/Down
        │   ├── Header/       # Timer, ActionButtons, CurrentClue, PuzzleSelector, Modal
        │   ├── Auth/         # GoogleSignIn.tsx, UserMenu.tsx
        │   └── Library/      # PuzzleLibrary.tsx, PuzzleCard.tsx — saved puzzle browser
        ├── hooks/
        │   ├── useKeyboard.ts     # Global keyboard handler
        │   └── useTimer.ts        # Timer formatting
        ├── utils/
        │   ├── gridUtils.ts       # Flat array → 2D grid, clue-cell mapping
        │   ├── navigationUtils.ts # Arrow key / Tab / word-jump logic
        │   ├── validationUtils.ts # Answer checking
        │   ├── savesManager.ts    # localStorage + API sync layer
        │   └── debounce.ts        # Debounce/throttle helpers
        ├── api/
        │   ├── client.ts    # puzzleApi (Axios)
        │   ├── authApi.ts   # Auth API calls
        │   └── savesApi.ts  # Saves API calls
        └── types/
            ├── puzzle.ts    # Puzzle, Cell, ClueInfo, Selection interfaces
            └── auth.ts      # User, AuthState interfaces
```

---

## Backend (FastAPI / Python)

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | API info |
| GET | `/health` | None | Health check |
| GET | `/api/puzzles/{date}` | None | Puzzle by date (YYYY-MM-DD) |
| GET | `/api/puzzles/random/puzzle` | None | Random puzzle |
| GET | `/api/puzzles/today/historical` | None | Today's matching historical puzzle |
| POST | `/api/puzzles/{date}/check` | None | Validate answers |
| POST | `/api/puzzles/{date}/reveal` | None | Reveal answers |
| POST | `/api/auth/google` | None | Google ID token → JWT + user |
| GET | `/api/auth/me` | JWT | Get current user |
| GET | `/api/saves` | JWT | List all saves for user |
| GET | `/api/saves/{puzzle_id}` | JWT | Get full save data |
| PUT | `/api/saves/{puzzle_id}` | JWT | Upsert save |
| DELETE | `/api/saves/{puzzle_id}` | JWT | Delete save |
| POST | `/api/saves/bulk` | JWT | Bulk import (localStorage migration) |

### Authentication Flow

- Google OAuth via `@react-oauth/google` (frontend) sends ID token to `POST /api/auth/google`
- Backend verifies with `google-auth` library, finds or creates `User` in DB
- Returns an HS256 JWT (24hr expiry by default) stored in `localStorage`
- All protected endpoints use `HTTPBearer` + `AuthService.verify_jwt()`

### Database (PostgreSQL via Neon)

**ORM:** SQLAlchemy 2.0 async with `asyncpg` driver

**Tables:**

```sql
-- users
id          UUID  PK
google_id   VARCHAR(255)  UNIQUE NOT NULL
email       VARCHAR(255)  UNIQUE NOT NULL
name        VARCHAR(255)
avatar_url  VARCHAR
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ

-- saves
id              UUID  PK
user_id         UUID  FK → users.id (CASCADE DELETE)
puzzle_id       VARCHAR(20)         -- e.g. "2000-01-01"
user_grid       JSONB               -- list of [key, value] entries
checked_cells   JSONB               -- list of [key, value] entries
elapsed_seconds INTEGER
is_complete     BOOLEAN
cells_filled    INTEGER
total_cells     INTEGER
completion_pct  INTEGER
puzzle_date     VARCHAR(20)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
UNIQUE(user_id, puzzle_id)          -- constraint: uq_user_puzzle
```

**Connection:** `DATABASE_URL` env var. The engine strips `sslmode`/`channel_binding` from the URL and handles SSL via `connect_args` (required by Neon). Pool settings: size=5, max_overflow=10, recycle=300s.

### Puzzle Data Source

- GitHub archive: `https://github.com/doshea/nyt_crosswords` (~15,000 puzzles, 1977–2018)
- Fetched as JSON, cached to `/tmp/cache` in a `year/month/day.json` directory structure
- On non-serverless startup, pre-fetches the 7 most recent puzzles into cache

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `""` | Neon PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth client ID |
| `JWT_SECRET` | `"change-me-in-production"` | HMAC secret for JWT signing |
| `JWT_EXPIRY_HOURS` | `24` | JWT lifetime in hours |
| `CORS_ORIGINS` | `"*"` | Comma-separated allowed origins |
| `CACHE_DIR` | `"/tmp/cache"` | Puzzle file cache directory |
| `GITHUB_REPO_URL` | (doshea archive URL) | Puzzle archive base URL |

### Python Dependencies

```
fastapi, uvicorn, pydantic, httpx, python-dotenv
sqlalchemy[asyncio], asyncpg
google-auth, requests
PyJWT
```

---

## Frontend (React 19 + TypeScript + Vite)

### State Management

- **PuzzleContext** — `useReducer` with 14 action types managing: puzzle data, 2D grid, cell selection, highlighted word, user input, checked cells, timer, completion, loading/error states
- **AuthContext** — Google auth state, JWT token, new-user flag, localStorage persistence
- **SavesManager** (`savesManager.ts`) — unified save layer that writes to `localStorage` AND syncs to the API when authenticated; debounced 500ms on typing, throttled every 10s on timer ticks

### Key Frontend Features

- **Full keyboard navigation** — arrow keys, Tab/Shift+Tab (word jump), Space (toggle direction), Backspace (delete + move back), letter input with auto-advance
- **Clue display** — two-column Across/Down panel, auto-scrolls to active clue, click a clue to jump to its first cell
- **Check / Reveal** — validate filled cells with red highlighting for wrong answers; reveal a single cell or the full puzzle (with confirmation dialog)
- **Puzzle Library** — modal browser of all saved/played puzzles showing completion % and elapsed time; click any to resume
- **Confetti** — canvas-based animation on puzzle completion
- **Google Sign-In** — floating sign-in button in header; on first login, prompts to migrate existing localStorage saves to the cloud via `POST /api/saves/bulk`
- **Puzzle Selector** — date-picker UI to load any puzzle by date from the archive

### Frontend Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "@react-oauth/google": "^0.13.4",
  "axios": "^1.13.5"
}
```

Build tool: **Vite 7**, TypeScript ~5.9

---

## Vercel Deployment

### Root `vercel.json`

```json
{
  "builds": [
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } },
    { "src": "api/index.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.py" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "frontend/$1" }
  ]
}
```

- All `/api/*` routes → Python serverless function (`api/index.py`)
- Static assets served from `frontend/dist`
- `api/index.py` adds `backend/` to `sys.path` and sets `VERCEL=1`
- When `VERCEL=1` is detected, the app skips puzzle pre-fetching (cold start optimization)
- Puzzle cache writes go to `/tmp/cache` (only writable directory on Vercel)

### Frontend `vercel.json`

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

Standard SPA catch-all rewrite so client-side routing works on direct URL access.

---

## Data Flow

1. User opens app → `App.tsx` calls `puzzleApi.getRandomPuzzle()` → FastAPI fetches from GitHub (or file cache) → returns puzzle JSON
2. `PuzzleContext` builds a 2D grid and clue map from the flat puzzle array
3. User types → `useKeyboard` dispatches `SET_CELL_VALUE` → `SavesManager.debouncedSaveProgress()` writes to localStorage (and API if authenticated)
4. User clicks Google Sign-In → `@react-oauth/google` returns a credential → `POST /api/auth/google` → JWT returned and stored in localStorage
5. Once JWT is set, `SavesManager` begins syncing all saves to `PUT /api/saves/{puzzle_id}` (PostgreSQL upsert with `ON CONFLICT DO UPDATE` on `uq_user_puzzle`)
6. Puzzle Library fetches `GET /api/saves` for metadata, then loads full save data on puzzle selection
