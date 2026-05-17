# NYT Crossword Clone

A fully functional crossword puzzle application that replicates the New York Times crossword interface. Built with FastAPI backend and React + TypeScript frontend. Supports real-time collaborative solving via Ably.

## Features

### Phase 1 (Complete)
- ✅ Interactive crossword grid with 15,000+ puzzles from 1977-2018
- ✅ Full keyboard navigation (arrow keys, Tab, Backspace, letter input)
- ✅ Cell highlighting and word selection
- ✅ Two-column clue display (Across/Down)
- ✅ Check answers feature with visual feedback
- ✅ Reveal cell/puzzle functionality
- ✅ Built-in timer with localStorage persistence
- ✅ Responsive design for mobile and desktop
- ✅ Auto-save progress

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- Pydantic (Data validation)
- HTTPX (HTTP client for fetching puzzles)
- File-based caching system

**Frontend:**
- React 18
- TypeScript
- Vite (Build tool)
- Axios (API client)
- CSS Modules

## Project Structure

```
nyt-crossword-clone/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration
│   │   ├── models/
│   │   │   └── puzzle.py        # Pydantic models
│   │   ├── services/
│   │   │   ├── puzzle_service.py    # Puzzle fetching logic
│   │   │   └── cache_service.py     # File cache management
│   │   └── api/
│   │       └── puzzles.py       # REST endpoints
│   ├── cache/                   # Cached puzzles
│   ├── requirements.txt
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Grid/            # Grid and Cell components
    │   │   ├── Clues/           # Clue list components
    │   │   └── Header/          # Timer and action buttons
    │   ├── context/
    │   │   └── PuzzleContext.tsx    # Global state management
    │   ├── hooks/
    │   │   ├── useKeyboard.ts       # Keyboard navigation
    │   │   └── useTimer.ts          # Timer utilities
    │   ├── utils/
    │   │   ├── gridUtils.ts         # Grid algorithms
    │   │   ├── navigationUtils.ts   # Navigation helpers
    │   │   └── validationUtils.ts   # Answer validation
    │   ├── types/
    │   │   └── puzzle.ts        # TypeScript types
    │   ├── api/
    │   │   └── client.ts        # API client
    │   └── App.tsx              # Main application
    └── package.json
```

## Setup and Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## API Endpoints

- `GET /api/puzzles/{date}` - Get puzzle by date (YYYY-MM-DD format)
- `GET /api/puzzles/random/puzzle` - Get random puzzle
- `GET /api/puzzles/today/historical` - Get today's historical puzzle
- `POST /api/puzzles/{date}/check` - Validate answers
- `POST /api/puzzles/{date}/reveal` - Reveal answers

## Usage

### Keyboard Navigation

- **Arrow Keys**: Move cell-by-cell in any direction
- **Tab**: Jump to next word in current direction
- **Shift+Tab**: Jump to previous word
- **Space**: Toggle between Across/Down
- **Backspace**: Clear current cell and move to previous
- **Letters**: Fill cell and auto-advance to next

### Mouse/Touch Navigation

- **Click a cell**: Select cell (default to Across)
- **Click same cell again**: Toggle direction
- **Click a clue**: Select the first cell of that word

### Action Buttons

- **Check**: Validate all filled cells (marks incorrect ones in red)
- **Reveal Cell**: Show correct letter for selected cell
- **Reveal Puzzle**: Show all answers (requires confirmation)
- **Clear Marks**: Remove error indicators
- **Reset**: Clear entire grid and timer

## Data Source

Puzzles are sourced from the public NYT Crosswords archive:
- Repository: https://github.com/doshea/nyt_crosswords
- Date range: 1977-2018 (~15,000 puzzles)
- Format: JSON files with grid, clues, and answers

## Key Algorithms

### Grid Rendering
Converts flat puzzle array to 2D grid with cell metadata (numbers, black squares, circles)

### Clue-Cell Mapping
Maps clue numbers to cell ranges by detecting word boundaries (black squares or edges)

### Keyboard Navigation
Handles arrow keys, Tab navigation, auto-advance, and word boundaries

### Answer Validation
Compares user input with correct answers and marks incorrect cells

## Future Enhancements (Phase 2)

- [ ] User authentication
- [ ] Multiplayer rooms (4+ players)
- [ ] Real-time collaboration via WebSockets
- [ ] Cursor presence indicators
- [ ] Room creation and joining
- [ ] PostgreSQL database
- [ ] Redis caching

## Performance

- Grid render: < 100ms for 15x15 grid
- Keyboard latency: < 50ms
- Puzzle fetch: < 200ms (cached)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - Feel free to use this project for learning or building your own crossword application.

## Acknowledgments

- NYT Crosswords archive by @doshea
- Inspired by the New York Times Crossword interface
