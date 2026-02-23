from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from ..models.puzzle import Puzzle, PuzzleResponse
from ..services.puzzle_service import PuzzleService
from ..services.cache_service import CacheService
from ..services.nyt_service import NytService, NytAuthError
from ..config import settings


router = APIRouter(prefix="/api/puzzles", tags=["puzzles"])

# Global service instances
cache_service = CacheService(cache_dir=settings.CACHE_DIR)
nyt_service = NytService(settings.NYT_COOKIE) if settings.NYT_COOKIE else None
puzzle_service = PuzzleService(
    cache_service=cache_service,
    github_base_url=settings.GITHUB_REPO_URL,
    nyt_service=nyt_service,
)


@router.get("/random/puzzle", response_model=PuzzleResponse)
async def get_random_puzzle():
    """Get a random crossword puzzle from the archive."""
    puzzle = await puzzle_service.get_random_puzzle()
    if puzzle is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch random puzzle"
        )

    puzzle_id = puzzle.date if puzzle.date else "unknown"
    return PuzzleResponse(puzzle=puzzle, puzzle_id=puzzle_id)


@router.get("/today/historical", response_model=PuzzleResponse)
async def get_today_historical():
    """Get today's historical puzzle (same month/day from a past year)."""
    puzzle = await puzzle_service.get_today_historical_puzzle()
    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail="No historical puzzle found for today's date"
        )

    puzzle_id = puzzle.date if puzzle.date else "unknown"
    return PuzzleResponse(puzzle=puzzle, puzzle_id=puzzle_id)


@router.get("/today/live", response_model=PuzzleResponse)
async def get_todays_live_puzzle():
    """Get today's live NYT puzzle (requires NYT_COOKIE)."""
    if nyt_service is None:
        raise HTTPException(
            status_code=503,
            detail="NYT live puzzles are not configured. Set NYT_COOKIE env var."
        )

    try:
        puzzle = await puzzle_service.get_todays_puzzle()
    except NytAuthError:
        raise HTTPException(
            status_code=403,
            detail="NYT subscription cookie is invalid or expired"
        )

    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail="Today's puzzle not found"
        )

    puzzle_id = puzzle.date if puzzle.date else "unknown"
    return PuzzleResponse(puzzle=puzzle, puzzle_id=puzzle_id)


@router.get("/today/mini", response_model=PuzzleResponse)
async def get_todays_mini_puzzle():
    """Get today's mini NYT puzzle (requires NYT_COOKIE)."""
    if nyt_service is None:
        raise HTTPException(
            status_code=503,
            detail="NYT live puzzles are not configured. Set NYT_COOKIE env var."
        )

    try:
        puzzle = await puzzle_service.get_todays_mini()
    except NytAuthError:
        raise HTTPException(
            status_code=403,
            detail="NYT subscription cookie is invalid or expired"
        )

    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail="Today's mini puzzle not found"
        )

    puzzle_id = puzzle.date if puzzle.date else "unknown"
    return PuzzleResponse(puzzle=puzzle, puzzle_id=puzzle_id)


@router.get("/mini/{date}", response_model=PuzzleResponse)
async def get_mini_puzzle_by_date(date: str):
    """Get a mini crossword puzzle by date (requires NYT_COOKIE)."""
    if nyt_service is None:
        raise HTTPException(
            status_code=503,
            detail="NYT live puzzles are not configured. Set NYT_COOKIE env var."
        )

    try:
        puzzle = await puzzle_service.get_puzzle(date, puzzle_type="mini")
    except NytAuthError:
        raise HTTPException(
            status_code=403,
            detail="NYT subscription cookie is invalid or expired"
        )

    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Mini puzzle not found for date {date}"
        )

    return PuzzleResponse(puzzle=puzzle, puzzle_id=date)


@router.get("/{date}", response_model=PuzzleResponse)
async def get_puzzle_by_date(date: str):
    """Get a crossword puzzle by date (2010-present if NYT_COOKIE is set)."""
    try:
        puzzle = await puzzle_service.get_puzzle(date)
    except NytAuthError:
        raise HTTPException(
            status_code=403,
            detail="NYT subscription cookie is invalid or expired"
        )

    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Puzzle not found for date {date}"
        )

    return PuzzleResponse(puzzle=puzzle, puzzle_id=date)


@router.post("/{date}/check")
async def check_puzzle(date: str, user_answers: dict):
    """Validate user answers against the puzzle solution.

    Args:
        date: Puzzle date in YYYY-MM-DD format
        user_answers: Dict with 'across' and 'down' user answers

    Returns:
        Validation results

    Raises:
        HTTPException: If puzzle not found
    """
    puzzle = await puzzle_service.get_puzzle(date)
    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Puzzle not found for date {date}"
        )

    # Compare user answers with correct answers
    results = {
        "across": {},
        "down": {}
    }

    for direction in ["across", "down"]:
        user_dir_answers = user_answers.get(direction, {})
        correct_answers = dict(zip(
            range(len(puzzle.answers[direction])),
            puzzle.answers[direction]
        ))

        for clue_num, user_answer in user_dir_answers.items():
            correct_answer = correct_answers.get(int(clue_num), "")
            results[direction][clue_num] = (
                user_answer.upper() == correct_answer.upper()
            )

    return results


@router.post("/{date}/reveal")
async def reveal_puzzle(date: str, reveal_type: str = "letter", clue_number: Optional[int] = None):
    """Reveal answers for the puzzle.

    Args:
        date: Puzzle date in YYYY-MM-DD format
        reveal_type: Type of reveal - 'letter', 'word', or 'puzzle'
        clue_number: Clue number for word reveals

    Returns:
        Revealed answers

    Raises:
        HTTPException: If puzzle not found
    """
    puzzle = await puzzle_service.get_puzzle(date)
    if puzzle is None:
        raise HTTPException(
            status_code=404,
            detail=f"Puzzle not found for date {date}"
        )

    if reveal_type == "puzzle":
        # Reveal entire puzzle
        return {
            "across": puzzle.answers["across"],
            "down": puzzle.answers["down"]
        }
    elif reveal_type == "word" and clue_number is not None:
        # Reveal specific word (would need direction)
        # This is simplified - in real implementation, frontend would specify direction
        return {
            "message": "Word reveal not fully implemented in this version"
        }
    else:
        return {
            "message": "Invalid reveal parameters"
        }
