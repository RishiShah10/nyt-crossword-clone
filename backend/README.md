# NYT Crossword Clone - Backend

FastAPI backend for the NYT Crossword Clone application.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment (optional):
```bash
cp .env.example .env
# Edit .env as needed
```

## Running

Start the development server:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

## API Documentation

Interactive API docs: http://localhost:8000/docs

## Endpoints

- `GET /api/puzzles/{date}` - Get puzzle by date (YYYY-MM-DD)
- `GET /api/puzzles/random/puzzle` - Get random puzzle
- `GET /api/puzzles/today/historical` - Get today's historical puzzle
- `POST /api/puzzles/{date}/check` - Validate answers
- `POST /api/puzzles/{date}/reveal` - Reveal answers

## Testing

Test the API:
```bash
# Get a specific puzzle
curl http://localhost:8000/api/puzzles/2018-12-31

# Get a random puzzle
curl http://localhost:8000/api/puzzles/random/puzzle

# Health check
curl http://localhost:8000/health
```
