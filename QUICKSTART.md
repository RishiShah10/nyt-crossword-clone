# Quick Start Guide

## Running the Application

### 1. Start the Backend

```bash
cd /Users/rishi-shah/nyt-crossword-clone/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Backend will be available at: http://localhost:8000

### 2. Start the Frontend

Open a new terminal:

```bash
cd /Users/rishi-shah/nyt-crossword-clone/frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

### 3. Open Your Browser

Navigate to http://localhost:5173 and start solving puzzles!

## What's Working

✅ **Backend (FastAPI)**
- Puzzle fetching from GitHub archive
- File-based caching system
- REST API with 5 endpoints
- 15,000+ puzzles from 1977-2018
- Pre-fetching on startup

✅ **Frontend (React + TypeScript)**
- Interactive crossword grid (15x15, 21x21, etc.)
- Full keyboard navigation
- Two-column clue display
- Cell highlighting and selection
- Check answers with visual feedback
- Reveal cell/puzzle functionality
- Built-in timer with auto-save
- Responsive mobile design

✅ **Features**
- Click cells to select
- Type letters to fill
- Arrow keys for navigation
- Tab to jump between words
- Backspace to delete and go back
- Space to toggle direction
- Auto-advance after typing
- Progress saved to localStorage
- Check button shows incorrect cells
- Reveal buttons show answers

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Letters** | Fill cell and auto-advance |
| **Arrow Keys** | Move cell-by-cell |
| **Tab** | Next word |
| **Shift+Tab** | Previous word |
| **Space** | Toggle Across/Down |
| **Backspace** | Delete and move back |

## Architecture

```
Backend (FastAPI) ←→ Frontend (React)
      ↓                    ↓
  File Cache          LocalStorage
      ↓
 GitHub Archive
(15,000 puzzles)
```

## Next Steps

You can now:
1. Solve puzzles from the archive
2. Check your answers
3. Use reveal if you're stuck
4. Try different dates for different puzzles
5. Practice keyboard navigation

Enjoy solving crosswords! 🧩
