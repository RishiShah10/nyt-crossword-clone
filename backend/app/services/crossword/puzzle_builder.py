"""
Puzzle builder — hybrid LLM + placement pipeline.

Approach (from https://github.com/Rperry2174/faster_crowssword_generator):
  1. LLM generates word+clue pairs from the topic in one call (CSV format).
     Words and clues are generated together so they're thematically coherent.
  2. CrosswordGenerator places them on a dynamic grid using intersection-based
     constraint satisfaction.
  3. Grid is trimmed to bounding box, gridnums are assigned, result is
     converted to NYT flat format for the frontend.

The LLM has zero structural responsibility — it only provides vocabulary +
clues. All layout guarantees come from the deterministic placement engine.
"""
from __future__ import annotations

import datetime
import logging
import re
from typing import Dict, List, Optional, Set, Tuple

from .grid_generator import CrosswordGenerator, CrosswordGrid, Direction, WordPlacement
from .word_list import WordList

logger = logging.getLogger(__name__)

# Module-level singleton — loaded once, reused across requests
_word_list: Optional[WordList] = None


def _get_valid_words() -> Set[str]:
    """Return the full ENABLE word set used for perpendicular validation."""
    global _word_list
    if _word_list is None:
        _word_list = WordList()
        logger.info("WordList singleton initialised (%d words)", len(_word_list._words))
    return _word_list._words


# ─── LLM word + clue generation ───────────────────────────────────────────────

_WORD_CLUE_SYSTEM = (
    "You are a NYT Mini crossword puzzle editor. "
    "Given a theme, produce word+clue pairs for a 5x5 mini crossword. "
    "Rules: words must be 3-5 letters only, common English words, "
    "no proper nouns, no abbreviations, no hyphens. "
    "Each clue must unambiguously and accurately lead to exactly that word. "
    "Include theme-specific words where natural; fill with common short words "
    "that share letters with theme words for crossing. "
    "Output format: one pair per line as WORD,clue text here"
)

_WORD_CLUE_USER = """\
Theme: {topics}

Generate exactly 20 crossword word+clue pairs for a 5x5 mini crossword.
CRITICAL: every word must be exactly 3, 4, or 5 letters. No longer.
Include both theme words AND common 3-5 letter English words that share letters.
Output only the CSV lines — no headers, no numbering, no extra text.

Example format:
HOOP,Ring the ball passes through
SLAM,Powerful dunk
NET,Mesh below the rim
PASS,Send the ball to a teammate
SHOT,Scoring attempt
"""


async def _get_words_and_clues(
    topics: str,
    openai_client,
) -> List[Tuple[str, str]]:
    """
    Ask the LLM for word+clue pairs. Returns list of (WORD, clue) tuples.
    Falls back to an empty list on failure (caller will raise).
    """
    prompt = _WORD_CLUE_USER.format(topics=topics)
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _WORD_CLUE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=1000,
        )
        raw = response.choices[0].message.content or ""
        return _parse_csv(raw)
    except Exception as exc:
        logger.error("Word/clue generation failed: %s", exc)
        return []


def _parse_csv(raw: str) -> List[Tuple[str, str]]:
    """
    Parse lines of "WORD,clue text" into validated (word, clue) tuples.
    Skips lines that don't parse cleanly or whose word is non-alphabetic.
    """
    pairs: List[Tuple[str, str]] = []
    seen: set[str] = set()
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Split on first comma only
        parts = line.split(",", 1)
        if len(parts) != 2:
            continue
        word = parts[0].strip().upper()
        clue = parts[1].strip()
        if not word or not clue:
            continue
        if not word.isalpha() or len(word) < 3 or len(word) > 5:  # 5x5 mini max
            continue
        if word in seen:
            continue
        seen.add(word)
        pairs.append((word, clue))
    logger.info("Parsed %d word+clue pairs from LLM", len(pairs))
    return pairs


# ─── Grid post-processing ──────────────────────────────────────────────────────

def _trim_grid(
    cg: CrosswordGrid,
) -> Tuple[List[List[Optional[str]]], List[WordPlacement], int, int]:
    """
    Crop the working grid to the minimum bounding box of placed letters.
    Returns (trimmed_grid, adjusted_placements, rows, cols).
    """
    grid = cg.grid
    placements = cg.word_placements

    filled_rows = [r for r in range(cg.height) if any(cell is not None for cell in grid[r])]
    filled_cols = [c for c in range(cg.width) if any(grid[r][c] is not None for r in range(cg.height))]

    if not filled_rows or not filled_cols:
        return grid, placements, cg.height, cg.width

    min_r, max_r = min(filled_rows), max(filled_rows)
    min_c, max_c = min(filled_cols), max(filled_cols)

    trimmed = [row[min_c: max_c + 1] for row in grid[min_r: max_r + 1]]
    rows = max_r - min_r + 1
    cols = max_c - min_c + 1

    adjusted = [
        WordPlacement(
            word=p.word,
            clue=p.clue,
            start_row=p.start_row - min_r,
            start_col=p.start_col - min_c,
            direction=p.direction,
        )
        for p in placements
    ]
    return trimmed, adjusted, rows, cols


def _assign_gridnums(
    placements: List[WordPlacement],
    rows: int,
    cols: int,
) -> Tuple[List[int], List[WordPlacement]]:
    """
    Assign crossword clue numbers (left-to-right, top-to-bottom).
    A cell gets a number if it starts any across or down word.
    Returns (flat gridnums array, placements with .number set).
    """
    # Collect all start cells
    start_cells = sorted({(p.start_row, p.start_col) for p in placements})
    cell_to_num: Dict[Tuple[int, int], int] = {
        cell: i + 1 for i, cell in enumerate(start_cells)
    }

    for p in placements:
        p.number = cell_to_num[(p.start_row, p.start_col)]

    gridnums = [0] * (rows * cols)
    for (r, c), num in cell_to_num.items():
        gridnums[r * cols + c] = num

    return gridnums, placements


# ─── NYT format assembly ───────────────────────────────────────────────────────

def _to_nyt_dict(
    grid: List[List[Optional[str]]],
    placements: List[WordPlacement],
    gridnums: List[int],
    rows: int,
    cols: int,
    title: str,
) -> dict:
    """
    Convert trimmed grid + placements → NYT-format puzzle dict.
    Empty cells become "." (black squares in NYT convention for unfilled cells).
    """
    flat_grid = [
        grid[r][c] if grid[r][c] is not None else "."
        for r in range(rows)
        for c in range(cols)
    ]

    across = sorted(
        [p for p in placements if p.direction == Direction.HORIZONTAL],
        key=lambda p: p.number,
    )
    down = sorted(
        [p for p in placements if p.direction == Direction.VERTICAL],
        key=lambda p: p.number,
    )

    return {
        "size": {"rows": rows, "cols": cols},
        "grid": flat_grid,
        "gridnums": gridnums,
        "clues": {
            "across": [f"{p.number}. {p.clue}" for p in across],
            "down": [f"{p.number}. {p.clue}" for p in down],
        },
        "answers": {
            "across": [p.word for p in across],
            "down": [p.word for p in down],
        },
        "title": title,
        "author": "AI Generator",
        "date": datetime.date.today().strftime("%Y-%m-%d"),
    }


def _validate(puzzle: dict) -> bool:
    """Basic sanity check on the assembled puzzle."""
    size = puzzle.get("size", {})
    rows, cols = size.get("rows", 0), size.get("cols", 0)
    expected = rows * cols
    if expected == 0:
        return False
    if len(puzzle.get("grid", [])) != expected:
        logger.error("Grid length mismatch: got %d expected %d", len(puzzle.get("grid", [])), expected)
        return False
    if not puzzle["clues"]["across"] or not puzzle["clues"]["down"]:
        logger.error("Missing across or down clues")
        return False
    return True


# ─── Public API ───────────────────────────────────────────────────────────────

async def build_puzzle(
    topics: str,
    title: str,
    openai_client,
    max_attempts: int = 5,
) -> dict:
    """
    Full pipeline:
      1. LLM generates word+clue pairs from topics (single call, CSV format)
      2. CrosswordGenerator places them on a grid (intersection-based)
      3. Trim bounding box → assign gridnums → convert to NYT format

    Retries up to max_attempts with fresh random seeds if the grid has
    too few words placed (< 4 across + down).

    Returns NYT-format puzzle dict.
    Raises RuntimeError if all attempts fail.
    """
    # Step 1: get words + clues from LLM (done once, reused across attempts)
    words_with_clues = await _get_words_and_clues(topics, openai_client)
    if len(words_with_clues) < 3:
        raise RuntimeError(
            f"LLM returned too few words ({len(words_with_clues)}) for topics '{topics}'. "
            "Try a different topic."
        )

    logger.info(
        "Generating crossword for '%s' with %d candidate words",
        topics, len(words_with_clues),
    )

    ROWS, COLS = 5, 5

    for attempt in range(max_attempts):
        # Step 2: placement in fixed 5x5 grid
        # strict_perp=False: empty cells act as black squares so adjacent letters
        # from different words don't need to form valid perpendicular words.
        generator = CrosswordGenerator(
            words_with_clues,
            valid_words=_get_valid_words(),
            grid_size=ROWS,
            strict_perp=False,
        )
        cg = generator.generate()

        across_count = sum(1 for p in cg.word_placements if p.direction == Direction.HORIZONTAL)
        down_count = sum(1 for p in cg.word_placements if p.direction == Direction.VERTICAL)

        if across_count < 2 or down_count < 2:
            logger.debug(
                "Attempt %d: only %d across / %d down — retrying",
                attempt + 1, across_count, down_count,
            )
            continue

        # Step 3: assign gridnums + assemble (no trimming — grid is fixed 5x5)
        placements = cg.word_placements
        gridnums, placements = _assign_gridnums(placements, ROWS, COLS)
        puzzle = _to_nyt_dict(cg.grid, placements, gridnums, ROWS, COLS, title)

        if _validate(puzzle):
            logger.info(
                "Puzzle built on attempt %d: 5x5, %d across, %d down",
                attempt + 1, across_count, down_count,
            )
            return puzzle

        logger.warning("Attempt %d: validation failed — retrying", attempt + 1)

    raise RuntimeError(
        f"Could not generate a valid 5x5 puzzle for '{topics}' after {max_attempts} attempts. "
        "Try different topics."
    )
